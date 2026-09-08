import { useState } from "react";
import { formatCustomerPhone, isValidCustomerPhone, normalizeCustomerPhone } from "../lib/customerAuth.ts";
import { saveCustomerDocument } from "../lib/firestoreCounter";

export default function PhoneLogin({ onClose }: { onClose: () => void }) {
  const current = (() => {
    try { return JSON.parse(localStorage.getItem("customer_current") || "null"); } catch { return null; }
  })();
  const [phone, setPhone] = useState(current?.phone || "");
  const [name, setName] = useState(current?.name || "");
  const saveProfile = async () => {
    const cleanName = name.trim();
    const cleanPhone = formatCustomerPhone(phone);
    if (!cleanName || !cleanPhone) return alert("اكتب الاسم ورقم الجوال");
    if (!isValidCustomerPhone(phone)) return alert("رقم الجوال يجب أن يتكون من 10 أرقام");
    const customer = { id: Date.now(), name: cleanName, phone: cleanPhone, date: new Date().toISOString() };
    let customers: unknown[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem("customers") || "[]");
      if (Array.isArray(saved)) customers = saved;
    } catch {}
    const phoneKey = normalizeCustomerPhone(cleanPhone);
    const uniqueCustomers = customers.filter(item => normalizeCustomerPhone(String((item as any).phone || "")) !== phoneKey);
    localStorage.setItem("customer_current", JSON.stringify({ name: cleanName, phone: cleanPhone }));
    localStorage.setItem("customers", JSON.stringify([...uniqueCustomers, customer]));
    localStorage.setItem("twelve_customer", JSON.stringify({ name: cleanName, phone: cleanPhone }));
    try {
      await saveCustomerDocument({ name: cleanName, phone: cleanPhone });
    } catch (error) {
      console.error("customer save failed", error);
    }
    onClose();
    window.dispatchEvent(new Event("customer-updated"));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ width: "92%", maxWidth: 380, background: "#fff", borderRadius: 22, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{width:60}}/>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111" }}>حسابي</h2>
          <button onClick={onClose} style={{ background: "#111", color: "#fff", border: "none", width: 36, height: 36, borderRadius: 50, fontSize: 18, fontWeight: 900, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ marginTop: 22 }}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="الاسم" style={{width:"100%",padding:16,borderRadius:14,border:"2.5px solid #111",background:"#fff",color:"#1f2937",WebkitTextFillColor:"#1f2937",textAlign:"right",fontSize:18,fontWeight:800,boxSizing:"border-box"}} />
          <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="رقم الجوال" style={{width:"100%",marginTop:10,padding:16,borderRadius:14,border:"2.5px solid #111",background:"#fff",color:"#1f2937",WebkitTextFillColor:"#1f2937",textAlign:"right",fontSize:18,fontWeight:800,boxSizing:"border-box"}} />
          <button type="button" onClick={saveProfile} style={{width:"100%",marginTop:12,padding:16,background:"#2B1A12",color:"#fff",border:"none",borderRadius:14,fontWeight:900}}>دخول</button>
        </div>
      </div>
    </div>
  );
}