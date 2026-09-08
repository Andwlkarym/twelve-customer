import { Link } from "wouter";

export default function MorePage() {
  return (
    <div dir="rtl" className="p-4 max-w-xl mx-auto pb-28">
      <h1 className="text-2xl font-bold mb-6">المزيد</h1>
      <div className="space-y-3">
        <Link href="/privacy-policy" className="flex justify-between p-4 bg-white rounded-2xl border shadow-sm">
          <span>🔒 سياسة الخصوصية</span><span>←</span>
        </Link>
        <a href="https://wa.me/9665XXXXXXXX" className="flex justify-between p-4 bg-white rounded-2xl border shadow-sm">
          <span>💬 تواصل معنا</span><span>←</span>
        </a>
      </div>
    </div>
  );
}