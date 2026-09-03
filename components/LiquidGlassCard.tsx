'use client';

import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  delay?: number;
  variant?: 'default' | 'blue' | 'dark';
}

export default function LiquidGlassCard({ children, className, onClick, delay = 0, variant = 'default' }: LiquidGlassCardProps) {
  // สร้างสไตล์กระจกแต่ละแบบตามภาพที่พี่โอส่งมา
  const variants = {
    default: "bg-white/5 border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]",
    blue: "bg-blue-500/20 border-blue-300/40 shadow-[0_8px_32px_0_rgba(37,99,235,0.25)]",
    dark: "bg-black/20 border-white/10"
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.02, translateY: -2 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
        delay: delay,
      }}
      className={cn(
        "relative overflow-hidden rounded-[2rem] cursor-pointer",
        // 🔮 เพิ่มความเบลอและการหักเหแสง (Refraction) ให้ลึกขึ้นแบบในรูป
        "backdrop-blur-[40px] backdrop-saturate-[180%]",
        // ✨ สร้างขอบสะท้อนแสงด้านบน (Specular Highlight) และเงาตกกระทบ
        "border shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.4)]",
        // 💧 สร้างเอฟเฟกต์มิติความหนาของกระจก
        "before:absolute before:inset-0 before:-z-10 before:rounded-[2rem]",
        "before:bg-gradient-to-br before:from-white/30 before:via-transparent before:to-transparent before:opacity-50",
        variants[variant],
        className
      )}
    >
      <div className="relative z-10 p-6">
        {children}
      </div>
      
      {/* เอฟเฟกต์แสงวิบวับตรงขอบล่าง (เหมือนขอบแก้วโดนแสง) */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-60" />
    </motion.div>
  );
}
