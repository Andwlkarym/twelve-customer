import React from "react";

export default function MoreMenu(){

  const setLocation = (p:string)=> { window.location.href = p; };

  return(
    <div style={{ padding:"16px", background:"#f5f5f5", minHeight:"100vh" }}>
      <div style={{ fontWeight:"800", fontSize:"20px", marginBottom:"16px", textAlign:"center" }}>المزيد</div>
      <button onClick={() => window.location.href = "/"}>
</button>

      <div style={{ background:"white", borderRadius:"16px", overflow:"hidden" }}>
        
        <div onClick={()=> setLocation("/about")} style={{ padding:"16px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid #eee", cursor:"pointer" }}>
          <span>من نحن</span><span>{">"}</span>
        </div>

        <div onClick={()=> setLocation("/privacy")} style={{ padding:"16px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid #eee", cursor:"pointer" }}>
          <span>سياسة الخصوصية</span><span>{">"}</span>
        </div>

        <div onClick={()=> setLocation("/terms")} style={{ padding:"16px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid #eee", cursor:"pointer" }}>
          <span>الشروط والاحكام</span><span>{">"}</span>
        </div>

        <div onClick={()=> setLocation("/contact")} style={{ padding:"16px", display:"flex", justifyContent:"space-between", cursor:"pointer" }}>
          <span>اتصل بنا</span><span>{">"}</span>
        </div>

      </div>

{/* اللوجو والتواصل - أيقونة واتساب فقط */}
<div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginTop:"28px", gap:"12px" }}>
  <img src="/logo.png" alt="logo" style={{ width:"62px", height:"62px", borderRadius:"50%", objectFit:"cover" }} />
</div>

    </div>
  );
}