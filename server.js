const express=require("express"),fs=require("fs"),path=require("path"),multer=require("multer"),crypto=require("crypto");
const app=express(),PORT=process.env.PORT||3000,ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"change-this-password";
const DATA=path.join(__dirname,"data"),DB=path.join(DATA,"db.json"),UP=path.join(__dirname,"uploads");
fs.mkdirSync(DATA,{recursive:true});fs.mkdirSync(UP,{recursive:true});
if(!fs.existsSync(DB))fs.writeFileSync(DB,JSON.stringify({products:[
{id:"p1",name:"Sunglass",price:0,description:"আপনার পণ্যের description এখানে লিখুন।",image:"",stock:true},
{id:"p2",name:"Wallet / Money Bag",price:0,description:"আপনার পণ্যের description এখানে লিখুন।",image:"",stock:true},
{id:"p3",name:"Premium Black Watch",price:400,description:"Premium quality stylish watch.",image:"watch.jpg",stock:true}],
orders:[],settings:{storeName:"Accessories Adda Hub",tagline:"Style starts with the right accessories.",
deliveryText:"সারা বাংলাদেশে ডেলিভারি। অর্ডারের আগে ডেলিভারি চার্জ ও সময় নিশ্চিত করুন।",
whatsapp:"01870697907",bkash:"",nagad:"",currency:"৳"}},null,2));
const read=()=>JSON.parse(fs.readFileSync(DB));const write=x=>fs.writeFileSync(DB,JSON.stringify(x,null,2));
app.use(express.json({limit:"2mb"}));app.use(express.urlencoded({extended:true}));app.use("/uploads",express.static(UP));app.use(express.static(path.join(__dirname,"public")));
const storage=multer.diskStorage({destination:(q,f,c)=>c(null,UP),filename:(q,f,c)=>c(null,Date.now()+"-"+crypto.randomBytes(4).toString("hex")+path.extname(f.originalname).toLowerCase())});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(q,f,c)=>/^image\/(jpeg|png|webp|gif)$/.test(f.mimetype)?c(null,true):c(new Error("Image only"))});
function auth(q,r,n){if(!q.headers["x-admin-token"]||q.headers["x-admin-token"]!==process.env.ADMIN_TOKEN_VALUE)return r.status(401).json({error:"Unauthorized"});n()}
app.post("/api/admin/login",(q,r)=>{if(q.body.password!==ADMIN_PASSWORD)return r.status(401).json({error:"Wrong password"});let t=crypto.randomBytes(32).toString("hex");process.env.ADMIN_TOKEN_VALUE=t;r.json({token:t})});
app.get("/api/products",(q,r)=>r.json(read().products.filter(p=>p.stock)));
app.get("/api/settings",(q,r)=>r.json(read().settings));
app.get("/api/admin/products",auth,(q,r)=>r.json(read().products));app.get("/api/admin/orders",auth,(q,r)=>r.json(read().orders));
app.post("/api/admin/upload",auth,upload.single("image"),(q,r)=>r.json({url:"/uploads/"+q.file.filename}));
app.post("/api/admin/products",auth,(q,r)=>{let d=read(),p={id:"p_"+Date.now(),name:q.body.name||"New Product",price:+q.body.price||0,description:q.body.description||"",image:q.body.image||"",stock:q.body.stock!=="false"};d.products.push(p);write(d);r.json(p)});
app.put("/api/admin/products/:id",auth,(q,r)=>{let d=read(),p=d.products.find(x=>x.id===q.params.id);if(!p)return r.status(404).json({error:"Not found"});Object.assign(p,{name:q.body.name??p.name,price:+(q.body.price??p.price),description:q.body.description??p.description,image:q.body.image??p.image,stock:q.body.stock===undefined?p.stock:(q.body.stock===true||q.body.stock==="true")});write(d);r.json(p)});
app.delete("/api/admin/products/:id",auth,(q,r)=>{let d=read();d.products=d.products.filter(x=>x.id!==q.params.id);write(d);r.json({ok:true})});
app.post("/api/orders",(q,r)=>{let {customer,items,payment}=q.body;if(!customer?.name||!customer?.phone||!customer?.address||!Array.isArray(items)||!items.length)return r.status(400).json({error:"Missing order information"});if(!["cod","bkash","nagad"].includes(payment?.method))return r.status(400).json({error:"Invalid payment method"});let d=read(),valid=[],total=0;for(let i of items){let p=d.products.find(x=>x.id===i.id&&x.stock);if(!p)continue;let qty=Math.max(1,Math.min(99,+i.qty||1));valid.push({id:p.id,name:p.name,price:p.price,qty});total+=p.price*qty}if(!valid.length)return r.status(400).json({error:"No valid products"});if(payment.method!=="cod"&&!payment.transactionId)return r.status(400).json({error:"Transaction ID required"});let o={id:"AAH-"+new Date().toISOString().slice(0,10).replaceAll("-","")+String(d.orders.length+1).padStart(3,"0"),createdAt:new Date().toISOString(),customer,items:valid,total,payment:{method:payment.method,transactionId:payment.transactionId||"",status:payment.method==="cod"?"Not applicable":"Pending"},status:"Pending"};d.orders.unshift(o);write(d);r.json(o)});
app.put("/api/admin/orders/:id",auth,(q,r)=>{let d=read(),o=d.orders.find(x=>x.id===q.params.id);if(!o)return r.status(404).json({error:"Not found"});let s=["Pending","Confirmed","Processing","Shipped","Delivered","Cancelled"];if(!s.includes(q.body.status))return r.status(400).json({error:"Invalid status"});o.status=q.body.status;write(d);r.json(o)});
app.put("/api/admin/orders/:id/payment",auth,(q,r)=>{let d=read(),o=d.orders.find(x=>x.id===q.params.id);if(!o)return r.status(404).json({error:"Not found"});if(!["Pending","Verified","Rejected"].includes(q.body.status))return r.status(400).json({error:"Invalid payment status"});o.payment.status=q.body.status;write(d);r.json(o)});
app.put("/api/admin/settings",auth,(q,r)=>{let d=read();d.settings={...d.settings,...q.body};write(d);r.json(d.settings)});
app.get("*",(q,r)=>r.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("Shop running on "+PORT));
