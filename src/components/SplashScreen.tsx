import { useEffect, useState } from "react";

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setHide(true);
      setTimeout(onFinish, 400);
    }, 1600);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"#FFFBF5",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:99999,
      opacity: hide? 0 : 1,
      transition:"opacity 0.4s ease"
    }}>
      <div style={{
        width:"min(72vw, 300px)",
        height:"min(72vw, 300px)",
        borderRadius:"50%",
        background:"#fff",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        padding:24,
        boxShadow:"0 12px 35px rgba(92, 55, 25, 0.14)",
        animation:"pulse 1.5s infinite ease-in-out"
      }}>
        <img
          src={`${import.meta.env.BASE_URL}images/logo.jpg`}
          alt="logo"
          style={{
            width:"100%",
            height:"100%",
            objectFit:"contain",
            borderRadius:"50%"
          }}
        />
      </div>
    </div>
  );
}