import { Link } from "wouter";

export default function AboutPage() {
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px" }}>
        
        <Link href="/more" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "white", padding: "8px 16px", borderRadius: "999px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", textDecoration: "none", color: "#111", fontSize: "13px" }}>
          ← رجوع للمزيد
        </Link>

        <div style={{ background: "white", borderRadius: "20px", padding: "20px", marginTop: "16px", textAlign: "center", border: "1px solid #f3f4f6" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "800" }}>من نحن</h1>
          <p style={{ fontSize: "13px", lineHeight: "1.9", color: "#6b7280", marginTop: "8px" }}>
            نحن مطعم <b style={{ color: "#111" }}>تويلف</b> لتقديم الوجبات السريعة، نحرص على الجودة والطعم الأصيل وسرعة الخدمة.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "16px", border: "1px solid #f3f4f6", textAlign: "center" }}>
            <div style={{ width: "36px", height: "36px", background: "#fef9c3", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>🌞</div>
            <h3 style={{ fontSize: "14px", fontWeight: "800" }}>الفترة الصباحية</h3>
            <p style={{ fontSize: "12px", color: "#9ca3af", lineHeight: "1.7", marginTop: "6px" }}>فلافل، سندوتشات فطور وغيرها من الوجبات السريعة الطازجة.</p>
          </div>
          <div style={{ background: "white", borderRadius: "16px", padding: "16px", border: "1px solid #f3f4f6", textAlign: "center" }}>
            <div style={{ width: "36px", height: "36px", background: "#fef9c3", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>🌙</div>
            <h3 style={{ fontSize: "14px", fontWeight: "800" }}>الفترة المسائية</h3>
            <p style={{ fontSize: "12px", color: "#9ca3af", lineHeight: "1.7", marginTop: "6px" }}>شاورما بأنواعها وسناكات متنوعة بطعم لا يقاوم.</p>
          </div>
        </div>

        <div style={{ background: "#0f172a", borderRadius: "16px", padding: "16px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "white" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: "800", fontSize: "14px" }}>يهمنا رضاء زبائننا</div>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>رأيكم يهمنا ونسعى دائماً للأفضل</div>
          </div>
          <div style={{ fontSize: "22px" }}>❤️</div>
        </div>

      </div>
    </div>
  );
}