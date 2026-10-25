const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json({limit:"32kb"}));
app.use(express.static(path.join(__dirname, "public")));

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
if (!serviceAccount.project_id) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON in Railway Variables.");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://rg-key-website-default-rtdb.asia-southeast1.firebasedatabase.app"
});
const db = admin.database();
const auth = admin.auth();
const ADMIN_UIDS = new Set((process.env.ADMIN_UIDS || "").split(",").map(x=>x.trim()).filter(Boolean));
const prices = {1:0,2:0,3:100,4:150,5:300,6:650,7:1000};
const taskRewards = {youtube:20,wa_channel:15,discord:20,video1:5,wa_group1:10,wa_group2:10,video2:1,video3:1,daily_task:15,small_task:5};
const dayKey = () => new Date().toISOString().slice(0,10);
const dateText = ms => new Date(ms).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"medium"});
const safeName = s => typeof s === "string" ? s.trim().slice(0,80) : "";
async function requireUser(req,res,next){
 try { const h=req.headers.authorization||""; if(!h.startsWith("Bearer ")) return res.status(401).json({error:"Sign in required."}); req.user=await auth.verifyIdToken(h.slice(7)); next(); }
 catch(e){ return res.status(401).json({error:"Invalid or expired sign-in. Refresh and try again."}); }
}
const userPath = uid => db.ref("rewards/users/"+uid);
async function requireAdmin(req,res,next){ if(!ADMIN_UIDS.has(req.user.uid)) return res.status(403).json({error:"This account is not an authorized admin."}); next(); }
app.get("/api/health",(req,res)=>res.json({ok:true}));
app.get("/api/me",requireUser,async(req,res)=>{
 const snap=await userPath(req.user.uid).get(), v=snap.val()||{}, today=dayKey();
 const os=await db.ref("rewards/orders").orderByChild("uid").equalTo(req.user.uid).get();
 const orders=[];os.forEach(c=>orders.push(c.val()));
 res.json({balance:Number(v.balance||0),dailyBonusClaimed:v.dailyBonusDay===today,orders:orders.sort((a,b)=>a.createdAt-b.createdAt)});
});
app.post("/api/daily-bonus",requireUser,async(req,res)=>{
 const ref=userPath(req.user.uid),today=dayKey();let error=null;
 const result=await ref.transaction(v=>{v=v||{balance:0};if(v.dailyBonusDay===today){error="Daily bonus already claimed.";return;}v.balance=Number(v.balance||0)+10;v.dailyBonusDay=today;return v;});
 if(error||!result.committed)return res.status(409).json({error:error||"Could not claim daily bonus."});
 res.json({balance:Number(result.snapshot.val().balance||0),awarded:10});
});
app.post("/api/claim-task",requireUser,async(req,res)=>{
 const taskId=String(req.body?.taskId||"");const reward=taskRewards[taskId];if(!reward)return res.status(400).json({error:"Unknown task."});
 const today=dayKey(),ref=userPath(req.user.uid);let error=null;
 const result=await ref.transaction(v=>{v=v||{balance:0,taskClaims:{}};v.taskClaims=v.taskClaims||{};const key=today+"_"+taskId;if(v.taskClaims[key]){error="This task was already claimed today.";return;}v.balance=Number(v.balance||0)+reward;v.taskClaims[key]=true;return v;});
 if(error||!result.committed)return res.status(409).json({error:error||"Could not claim task."});
 res.json({balance:Number(result.snapshot.val().balance||0),awarded:reward});
});
app.post("/api/order",requireUser,async(req,res)=>{
 const days=Number(req.body?.days), discordUsername=safeName(req.body?.discordUsername), confirmed=req.body?.confirmed===true;
 if(!Number.isInteger(days)||!(days in prices))return res.status(400).json({error:"Choose a plan from 1 to 7 days."});
 if(!discordUsername||!confirmed)return res.status(400).json({error:"Enter your Discord Username and confirm it."});
 const cost=prices[days], userRef=userPath(req.user.uid);let err=null,balanceAfter=null;
 const result=await userRef.transaction(v=>{v=v||{balance:0};const bal=Number(v.balance||0);if(bal<cost){err=`Not enough Cards. This plan needs ${cost} Cards; your balance is ${bal}.`;return;}v.balance=bal-cost;balanceAfter=v.balance;return v;});
 if(err||!result.committed)return res.status(409).json({error:err||"Balance could not be updated. Please retry."});
 const createdAt=Date.now(),id="RG-"+createdAt.toString(36).toUpperCase()+"-"+crypto.randomBytes(3).toString("hex").toUpperCase();
 const order={id,uid:req.user.uid,discordUsername,days,cost,balanceAfter,status:"Pending",createdAt,createdAtText:dateText(createdAt)};
 try{await db.ref("rewards/orders/"+id).set(order)}catch(e){await userRef.transaction(v=>{v=v||{balance:0};v.balance=Number(v.balance||0)+cost;return v});return res.status(500).json({error:"Order could not be saved; Cards were restored. Try again."});}
 res.json({balance:balanceAfter,order});
});
app.get("/api/admin/orders",requireUser,requireAdmin,async(req,res)=>{
 const snap=await db.ref("rewards/orders").get(),orders=[];snap.forEach(c=>orders.push(c.val()));orders.sort((a,b)=>b.createdAt-a.createdAt);res.json({orders});
});
app.post("/api/admin/order-status",requireUser,requireAdmin,async(req,res)=>{
 const id=String(req.body?.id||""),status=String(req.body?.status||"");
 if(!["Pending","Approved","Completed","Rejected"].includes(status))return res.status(400).json({error:"Invalid status."});
 const ref=db.ref("rewards/orders/"+id),snap=await ref.get();if(!snap.exists())return res.status(404).json({error:"Order not found."});
 await ref.update({status,statusUpdatedAt:Date.now(),statusUpdatedAtText:dateText(Date.now()),statusUpdatedBy:req.user.uid});res.json({ok:true});
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","user.html")));
const port=process.env.PORT||3000;app.listen(port,()=>console.log("RG Cards Rewards backend listening on "+port));
