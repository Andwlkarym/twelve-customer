import { useState } from "react";

export default function ItemNote({ item }: any) {
  const [note, setNote] = useState(item.note || "");
  
  return (
    <input
      type="text"
      value={note}
      onChange={(e) => {
        setNote(e.target.value);
        item.note = e.target.value;
      }}
      placeholder="ملاحظتك: بدون شطة، و...ن..."
      className="w-full mt-2 p-2.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-orange-400"
    />
  );
}