import { Link } from "wouter";

export default function TermsPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[#f9fafb]">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-[480px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/more" className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center">
            ‹
          </Link>
          <h1 className="font-bold text-[16px]">الشروط والأحكام</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="max-w-[480px] mx-auto p-4">
        <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
          <h2 className="font-extrabold text-[18px] mb-1">مرحبا بك في Twelve</h2>
          <p className="text-[13px] text-gray-400 mb-4">آخر تحديث: 31 أغسطس 2026</p>

          <div className="h-[1px] bg-gray-100 my-4" />

          <div className="space-y-5 text-[14px] leading-7 text-[#374151]">
            <div>
              <h3 className="font-bold text-black mb-1">1- الأسعار والضريبة</h3>
              <p>جميع الأسعار المعروضة في التطبيق شاملة ضريبة القيمة.</p>
            </div>

            <div>
              <h3 className="font-bold text-black mb-1">2- الطلبات والإلغاء</h3>
              <p>لا يمكن إلغاء الطلب بعد تأكيد المطعم له. في حال عدم توفر صنف سيتم التواصل معك لاستبداله أو استرجاع قيمته.</p>
            </div>

            <div>
              <h3 className="font-bold text-black mb-1">3- وقت التوصيل</h3>
              <p>وقت التوصيل المعروض هو وقت تقديري ويعتمد على ضغط الطلبات وحالة الطريق. Twelve لا يضمن وصول الطلب في وقت محدد.</p>
            </div>

            <div>
              <h3 className="font-bold text-black mb-1">4- سياسة الاسترداد</h3>
              <p>في حال وجود خطأ في الطلب أو عدم استلام الطلب، يمكنك التواصل معنا عبر صفحة "اتصل بنا" وسيتم تعويضك.</p>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 pb-6">
          <p className="text-[11px] text-gray-400 tracking-widest">POWERED BY</p>
          <p className="text-[13px] font-bold text-gray-800">Abdulkarim Al-Dhafri</p>
        </div>
      </div>
    </div>
  );
}