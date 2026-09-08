import { Link } from "wouter";

export default function PrivacyPage() {
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px" }}>
        
        <Link href="/more" style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "white", padding: "8px 16px", borderRadius: "999px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", textDecoration: "none", color: "#111", fontSize: "13px" }}>
          ← رجوع للمزيد
        </Link>

        <div style={{ background: "white", borderRadius: "20px", padding: "24px", marginTop: "16px", border: "1px solid #f3f4f6" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "800", textAlign: "center" }}>سياسة الخصوصية</h1>
          <p style={{ fontSize: "12px", color: "#9ca3af", textAlign: "center", marginTop: "6px" }}>تويلف شاورما وفلافل - آخر تحديث: 2025</p>

          <div style={{ marginTop: "28px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", textAlign: "right" }}>1. المعلومات التي نجمعها</h3>
            <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.9", marginTop: "8px", textAlign: "right" }}>
              نقوم بجمع الاسم ورقم الجوال والعنوان فقط لغرض توصيل الطلبات وتحسين الخدمة. لا نطلب أي معلومات بنكية داخل التطبيق.
            </p>
          </div>

          <div style={{ marginTop: "28px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", textAlign: "right" }}>2. كيف نستخدم بياناتك</h3>
            <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.9", marginTop: "8px", textAlign: "right" }}>
              نستخدم بياناتك لتنفيذ طلبك، التواصل معك بخصوص الطلب، وإرسال عروض خاصة من المطعم في حال وافقت على ذلك.
            </p>
          </div>

          <div style={{ marginTop: "28px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", textAlign: "right" }}>3. حماية البيانات</h3>
            <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.9", marginTop: "8px", textAlign: "right" }}>
              بياناتك محفوظة بشكل آمن ولا يتم مشاركتها مع أي طرف ثالث إلا لغرض التوصيل فقط. يهمنا الحفاظ على خصوصيتك.
            </p>
          </div>

          <div style={{ marginTop: "28px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", textAlign: "right" }}>4. التواصل</h3>
            <p style={{ fontSize: "13px", color: "#6b7280", lineHeight: "1.9", marginTop: "8px", textAlign: "right" }}>
              لأي استفسار حول الخصوصية تواصل معنا على الرقم <b style={{ color: "#111" }}>0557380204</b> أو عبر الواتساب.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}