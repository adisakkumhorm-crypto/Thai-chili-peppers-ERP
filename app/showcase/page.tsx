'use client';

import { motion } from 'framer-motion';
import { Layers, MousePointer2, Move, Type, Square, ZoomIn, Sun, Moon, ChevronRight, SlidersHorizontal, Eye, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AdvancedShowcasePage() {
  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 md:p-8 bg-[#0a0c10] font-sans overflow-hidden">
      
      {/* 🌈 Dynamic Background (Refraction Source) */}
      <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-600/30 blur-[120px] mix-blend-screen animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/30 blur-[150px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[20%] right-[30%] w-[40%] h-[40%] rounded-full bg-cyan-500/20 blur-[100px] mix-blend-screen" />

      {/* 🔮 Main Window - Ultra-thick Liquid Glass Slab */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[1400px] h-[85vh] rounded-[2.5rem] flex flex-col overflow-hidden
          bg-white/[0.04] backdrop-blur-[60px] backdrop-saturate-[200%]
          border border-white/[0.08] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.3),inset_0_-1px_2px_rgba(255,255,255,0.05)]"
      >
        
        {/* 🪟 Top Toolbar */}
        <div className="h-[68px] border-b border-white/[0.08] flex items-center justify-between px-6 bg-gradient-to-b from-white/[0.05] to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_0_10px_rgba(255,95,86,0.5)] cursor-pointer" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_0_10px_rgba(255,189,46,0.5)] cursor-pointer" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#27C93F] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_0_10px_rgba(39,201,63,0.5)] cursor-pointer" />
          </div>

          <div className="flex items-center gap-3 bg-black/20 p-1.5 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md">
            <button className="p-2.5 bg-white/10 rounded-xl text-white shadow-[0_2px_10px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)]"><MousePointer2 size={16} /></button>
            <button className="p-2.5 text-white/50 hover:text-white transition-colors"><Move size={16} /></button>
            <button className="p-2.5 text-white/50 hover:text-white transition-colors"><Square size={16} /></button>
            <button className="p-2.5 text-white/50 hover:text-white transition-colors"><Type size={16} /></button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-white/80 text-sm font-medium bg-black/20 px-4 py-2 rounded-xl border border-white/5 shadow-inner cursor-pointer hover:bg-black/30 transition-colors">
              <span>60%</span>
              <ChevronDown size={14} className="text-white/50" />
            </div>
          </div>
        </div>

        {/* 🖥️ 3-Column Workspace */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* ⬅️ Left Sidebar: Layer List */}
          <div className="w-[280px] border-r border-white/[0.08] flex flex-col bg-white/[0.01]">
            <div className="p-5 border-b border-white/[0.05]">
              <h2 className="text-white/90 font-semibold text-sm flex items-center gap-2 tracking-wide"><Layers size={16} className="text-blue-400" /> Layers</h2>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-1">
              <LayerItem title="Groups" active icon="folder" hasChildren />
              <div className="pl-7 space-y-1 my-1 relative before:absolute before:left-3.5 before:top-0 before:bottom-0 before:w-px before:bg-white/10">
                <LayerItem title="Person" icon="vector" />
                <LayerItem title="Circle 1" icon="shape" />
                <LayerItem title="Circle 2" icon="shape" />
              </div>
              <LayerItem title="Background" icon="bg" />
            </div>
          </div>

          {/* 🎯 Center Canvas: 3D Fused Glass Sculpture */}
          <div className="flex-1 relative flex items-center justify-center bg-black/10 overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            
            {/* Podcasts Icon (3D Glass) */}
            <motion.div 
              animate={{ rotateY: [0, 8, -8, 0], rotateX: [0, -4, 4, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-72 h-72 rounded-[3.5rem] 
                bg-gradient-to-br from-[#E641FF]/40 via-[#8A3FFF]/30 to-[#3B82F6]/40
                backdrop-blur-[30px] backdrop-saturate-[250%]
                border border-white/40
                shadow-[0_40px_100px_-20px_rgba(138,63,255,0.6),inset_0_4px_10px_rgba(255,255,255,0.8),inset_0_-4px_20px_rgba(0,0,0,0.4)]
                flex flex-col items-center justify-center
                before:absolute before:inset-0 before:rounded-[3.5rem] before:bg-gradient-to-tr before:from-transparent before:via-white/10 before:to-white/50 before:pointer-events-none"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Internal Glass Layer */}
              <div className="absolute inset-2 rounded-[3rem] border border-white/30 bg-gradient-to-b from-white/20 to-transparent mix-blend-overlay shadow-[inset_0_0_20px_rgba(255,255,255,0.3)]" />
              
              {/* Central Mic Symbol */}
              <div className="relative z-10 w-28 h-28 flex items-center justify-center drop-shadow-[0_15px_25px_rgba(0,0,0,0.5)]">
                 <div className="w-14 h-24 rounded-full bg-gradient-to-b from-white via-white/90 to-white/60 shadow-[inset_0_-5px_15px_rgba(0,0,0,0.3),0_0_20px_rgba(255,255,255,0.5)]" />
                 <div className="absolute bottom-2 w-20 h-14 border-b-[5px] border-l-[5px] border-r-[5px] border-white rounded-b-full shadow-[0_5px_10px_rgba(0,0,0,0.2)]" />
                 <div className="absolute -bottom-5 w-2.5 h-7 bg-white shadow-[0_5px_10px_rgba(0,0,0,0.2)]" />
                 <div className="absolute -bottom-5 w-12 h-[5px] bg-white rounded-full shadow-[0_5px_10px_rgba(0,0,0,0.2)]" />
              </div>
            </motion.div>
          </div>

          {/* ➡️ Right Sidebar: Neumorphic Glass Properties */}
          <div className="w-[320px] border-l border-white/[0.08] bg-gradient-to-l from-white/[0.03] to-white/[0.01] flex flex-col backdrop-blur-xl">
            <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
              <h2 className="text-white/90 font-semibold text-sm flex items-center gap-2 tracking-wide"><SlidersHorizontal size={16} className="text-pink-400" /> Liquid Glass</h2>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-8">
              
              {/* Sliders matching image text */}
              <div className="space-y-7">
                <GlassSlider label="Specular" value="85%" percent={85} color="from-pink-400 to-rose-400" />
                <GlassSlider label="Blur & Translucency" value="100px" percent={70} color="from-purple-400 to-fuchsia-400" />
                <GlassSlider label="Dark & Shadow" value="40%" percent={40} color="from-slate-400 to-slate-600" />
                <GlassSlider label="Refraction" value="High" percent={90} color="from-blue-400 to-cyan-400" />
              </div>

              {/* Liquid Neumorphic Toggles */}
              <div className="space-y-4 pt-6 border-t border-white/[0.05]">
                <GlassToggle label="Volumetric Light" active />
                <GlassToggle label="Caustics Effect" active />
              </div>
              
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}

// ----------------- Sub-components ----------------- //

function LayerItem({ title, active = false, icon, hasChildren = false }: { title: string, active?: boolean, icon: string, hasChildren?: boolean }) {
  return (
    <div className={cn(
      "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-300 cursor-pointer border border-transparent",
      active ? "bg-blue-500/15 text-white border-blue-400/30 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_4px_12px_rgba(0,0,0,0.2)]" : "text-white/60 hover:bg-white/5 hover:text-white"
    )}>
      <div className="flex items-center gap-3">
        {hasChildren && <ChevronDown size={14} className={active ? "text-blue-300" : "text-white/40"} />}
        {!hasChildren && <div className="w-3.5" />}
        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shadow-inner", 
          icon === 'folder' ? "bg-blue-500/30" : 
          icon === 'vector' ? "bg-purple-500/30" : 
          icon === 'shape' ? "bg-pink-500/30" : "bg-slate-500/30"
        )}>
           <span className="text-[12px]">{icon === 'folder' ? '📁' : icon === 'vector' ? '✒️' : icon === 'shape' ? '⭕' : '🖼️'}</span>
        </div>
        <span className={cn(active ? "font-semibold tracking-wide" : "font-medium")}>{title}</span>
      </div>
      <Eye size={16} className={active ? "text-blue-400" : "text-white/20 hover:text-white/60"} />
    </div>
  );
}

function GlassSlider({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-sm">
        <span className="text-white/80 font-medium">{label}</span>
        <span className="text-white/50 bg-black/20 px-2 py-0.5 rounded-md border border-white/5 text-xs">{value}</span>
      </div>
      {/* Neumorphic Track */}
      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]">
        {/* Glowing Fill */}
        <div 
          className={cn("h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)] bg-gradient-to-r", color)} 
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function GlassToggle({ label, active }: { label: string, active: boolean }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <span className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors">{label}</span>
      <div className={cn(
        "w-12 h-7 rounded-full p-1 transition-all duration-300 ease-in-out border shadow-inner",
        active ? "bg-blue-500/40 border-blue-400/50 shadow-[inset_0_2px_5px_rgba(0,0,0,0.3)]" : "bg-black/50 border-white/10"
      )}>
        <motion.div 
          layout
          className="w-5 h-5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.3),inset_0_-2px_4px_rgba(0,0,0,0.2)]"
          animate={{ x: active ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>
    </div>
  );
}
