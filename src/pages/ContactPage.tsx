import { Link } from "wouter";

export default function ContactPage() {
  const phone = "0557380204";
  const whatsappLink = `https://wa.me/966557380204`;

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px" }}>
        
        {/* زر الرجوع للمزيد */}
        <Link href="/more" className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center inline-flex">
          ‹
        </Link>

        <div style={{ background: "white", borderRadius: "20px", padding: "20px", marginTop: "16px", textAlign: "center" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "800" }}>تويلف شاورما وفلافل</h1>
          <p style={{ color: "#9ca3af", fontSize: "13px" }}>للتواصل</p>
        </div>

        <div style={{ background: "white", borderRadius: "20px", padding: "16px", marginTop: "16px" }}>
          <a href={`tel:${phone}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "black", padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", background: "#0f172a", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>📞</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>رقم التواصل</div>
                <div style={{ fontWeight: "700" }}>{phone}</div>
              </div>
            </div>
            <span>›</span>
          </a>

          <a href={whatsappLink} target="_blank" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "black", padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", background: "#22c55e", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "800" }}>W</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>واتساب</div>
                <div style={{ fontWeight: "700", color: "#166534" }}>{phone}</div>
              </div>
            </div>
            <span style={{ color: "#22c55e" }}>›</span>
          </a>

          <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            <a href={`tel:${phone}`} style={{ flex: 1, background: "#0f172a", color: "white", textAlign: "center", padding: "14px", borderRadius: "14px", textDecoration: "none", fontWeight: "700" }}>اتصال</a>
            <a href={whatsappLink} target="_blank" style={{ flex: 1, background: "#22c55e", color: "white", textAlign: "center", padding: "14px", borderRadius: "14px", textDecoration: "none", fontWeight: "700" }}>واتساب</a>
          </div>
        </div>
      </div>
    </div>
  );
}