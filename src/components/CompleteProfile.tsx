import { useState } from "react";
import { getDatabase, ref, set } from "firebase/database";
import { saveCustomer } from "../lib/customerAuth.ts";

export default function CompleteProfile({ phone, uid, onDone }: any){
  const [name,setName]=useState(String(localStorage.getItem("userName") || ""));
  const [district,setDistrict]=useState("");
  const [address,setAddress]=useState("");

  const save = async ()=>{
    const cleanName = name.trim();
    const cleanPhone = String(phone || "").trim();
    if(!cleanName || !cleanPhone){ alert("اكتب الاسم ورقم الجوال"); return; }
    const db = getDatabase();
    await set(ref(db, `customers/${uid}`), {
      uid, phone: cleanPhone, name: cleanName, district: district.trim(), address: address.trim(),
      createdAt: new Date().toISOString(),
    });
    saveCustomer(cleanName, cleanPhone, { uid, district: district.trim(), address: address.trim() });
    localStorage.setItem("userName", cleanName);
    localStorage.setItem("userDistrict", district);
    localStorage.setItem("userPhone", cleanPhone);
    localStorage.setItem("userUid", uid);
    onDone();
  };

  return (
    <div style={{background:"#fff", padding:20, borderRadius:16, width:"90%", maxWidth:360, margin:"20px auto", boxShadow:"0 10px 30px rgba(0,0,0,0.1)"}}>
      <h3 style={{textAlign:"center", marginBottom:15}}>اكمال البيانات 👤</h3>
      <p style={{fontSize:12, color:"#666", textAlign:"center"}}>{phone}</p>
      
      <input 
        placeholder="الاسم الكامل" 
        value={name} 
        onChange={e=>setName(e.target.value)} 
        style={{width:"100%", padding:12, borderRadius:10, border:"1px solid #ddd", marginBottom:10}}
      />
      <input 
        placeholder="الحي - مثلا الروضة" 
        value={district} 
        onChange={e=>setDistrict(e.target.value)} 
        style={{width:"100%", padding:12, borderRadius:10, border:"1px solid #ddd", marginBottom:10}}
      />
      <input 
        placeholder="وصف البيت" 
        value={address} 
        onChange={e=>setAddress(e.target.value)} 
        style={{width:"100%", padding:12, borderRadius:10, border:"1px solid #ddd", marginBottom:15}}
      />
      
      <button onClick={save} style={{width:"100%", padding:14, background:"#e11d48", color:"#fff", border:"none", borderRadius:12, fontWeight:"bold", fontSize:16}}>
        حفظ ومتابعة ✅
      </button>

      <div style={{marginTop:20, borderTop:"1px solid #eee", paddingTop:12, display:"flex", justifyContent:"space-around", color:"#888", fontSize:13}}>
        <span>❤️ المفضلة</span>
        <span>📦 </span>
      </div>
    </div>
  )
}