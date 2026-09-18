"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface HeroProps {
  className?: string;
}

export function Hero({ className }: HeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Particle[] = [];
    const particleCount = 60;
    const connectionDistance = 120;
    const mouse = { x: -1000, y: -1000 };

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
      type: "bank" | "gateway" | "orders" | "accounting" | "reconcilex" | "matched" | "potential" | "exception";
    }

    const types = [
      { key: "bank", color: "#00D4AA", label: "BANK" },
      { key: "gateway", color: "#F59E0B", label: "GATEWAY" },
      { key: "orders", color: "#3B82F6", label: "ORDERS" },
      { key: "accounting", color: "#8B5CF6", label: "ACCOUNTING" },
      { key: "reconcilex", color: "#FFFFFF", label: "RECONCILEX" },
      { key: "matched", color: "#10B981", label: "MATCHED" },
      { key: "potential", color: "#F59E0B", label: "POTENTIAL" },
      { key: "exception", color: "#EF4444", label: "EXCEPTION" },
    ];

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    function initParticles() {
      particles.length = 0;
      const width = canvas?.offsetWidth ?? 0;
      const height = canvas?.offsetHeight ?? 0;

      for (let i = 0; i < particleCount; i++) {
        const typeIndex = i < 4 ? i : i < 5 ? 4 : i < particleCount * 0.7 ? 5 : i < particleCount * 0.85 ? 6 : 7;
        const type = types[typeIndex];

        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          radius: typeIndex === 4 ? 16 : typeIndex < 4 ? 10 : 6,
          opacity: 0.4 + Math.random() * 0.3,
          type: type.key as Particle["type"],
        });
      }
    }

    function animate() {
      if (!ctx || !canvas) return;

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < p.radius) {
          p.x = p.radius;
          p.vx *= -1;
        }
        if (p.x > width - p.radius) {
          p.x = width - p.radius;
          p.vx *= -1;
        }
        if (p.y < p.radius) {
          p.y = p.radius;
          p.vy *= -1;
        }
        if (p.y > height - p.radius) {
          p.y = height - p.radius;
          p.vy *= -1;
        }

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
          const force = (150 - dist) / 150 * 0.3;
          p.vx -= dx / dist * force;
          p.vy -= dy / dist * force;
        }

        p.vx *= 0.985;
        p.vy *= 0.985;
      });

      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 0.5;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x;
          const dy = particles[j].y - particles[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            const alpha = 1 - dist / connectionDistance;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.03})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      particles.forEach((p) => {
        const typeInfo = types.find((t) => t.key === p.type);
        if (!typeInfo) return;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = typeInfo.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;

        if (p.radius > 8) {
          ctx.font = `bold ${p.radius * 0.4}px Geist, sans-serif`;
          ctx.fillStyle = p.type === "reconcilex" ? "#0A0F14" : "#FFFFFF";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(typeInfo.label, p.x, p.y + p.radius * 0.15);
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    function handleMouseMove(e: MouseEvent) {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }

    function handleMouseLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }

    resize();
    initParticles();

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    canvasEl.addEventListener("mousemove", handleMouseMove);
    canvasEl.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", () => {
      resize();
      initParticles();
    });

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current!);
      if (canvasEl) {
        canvasEl.removeEventListener("mousemove", handleMouseMove);
        canvasEl.removeEventListener("mouseleave", handleMouseLeave);
      }
      window.removeEventListener("resize", () => {
        resize();
        initParticles();
      });
    };
  }, []);

  // GSAP ScrollTrigger animations for content
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(
        section.querySelector(".hero-title"),
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.2,
          ease: "power4.out",
        }
      );

      // Subtitle animation
      gsap.fromTo(
        section.querySelector(".hero-subtitle"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          delay: 0.2,
        }
      );

      // Buttons animation
      gsap.fromTo(
        section.querySelector(".hero-buttons"),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.4,
        }
      );

      // Scroll indicator
      gsap.fromTo(
        section.querySelector(".scroll-indicator"),
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          delay: 1,
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={cn("relative min-h-screen flex items-center justify-center overflow-hidden", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Animated transaction flow visualization showing data sources converging into ReconcileX"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/90 via-navy-900/60 to-navy-900/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/3 via-transparent to-transparent" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="hero-title">
          <h1 className="text-4xl lg:text-6xl xl:text-7xl font-semibold tracking-tight text-white text-balance leading-[1.1]">
            Turn fragmented transaction data into one clear financial picture.
          </h1>
        </div>
        <div className="mt-6 hero-subtitle">
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto text-pretty leading-relaxed">
            ReconcileX automatically compares transaction records across independent systems, identifies mismatches, and gives finance teams a structured workflow to investigate and resolve them.
          </p>
        </div>
        <div className="mt-10 hero-buttons">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900 px-6 py-3 text-base gap-2.5 bg-cyan-500 text-navy-900 hover:bg-cyan-400 active:bg-cyan-600 shadow-sm"
            >
              Explore ReconcileX
              <svg className="ml-2 w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900 px-6 py-3 text-base gap-2.5 border border-navy-500 text-gray-200 hover:bg-navy-700 hover:border-navy-400 active:bg-navy-600"
            >
              View Dashboard
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 scroll-indicator">
        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}