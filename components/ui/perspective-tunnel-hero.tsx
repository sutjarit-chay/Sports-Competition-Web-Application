"use client";

import {
  motion,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Locally served Unsplash sports photographs; no runtime CDN dependency.
const IMAGES = Array.from({ length: 9 }, (_, i) => ({
  src:
    i % 2 === 0
      ? "/assets/sports/athletics.jpg"
      : "/assets/sports/football.jpg",
  title: i % 2 === 0 ? "ATHLETICS" : "FOOTBALL",
}));

interface TunnelCardData {
  item: { src: string; title: string };
  angleCos: number;
  angleSin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  index: number;
}

const TUNNEL_CARDS: TunnelCardData[] = IMAGES.map((item, i) => {
  const goldenAngle = i * 137.5 * (Math.PI / 180);
  return {
    item,
    angleCos: Math.cos(goldenAngle),
    angleSin: Math.sin(goldenAngle),
    radiusFactorX: 0.31 + (i % 3) * 0.035,
    radiusFactorY: 0.18 + (i % 2) * 0.05,
    rotationZ: (i % 2 === 0 ? 1 : -1) * (8 + (i % 3) * 3),
    index: i,
  };
});
const SPRING_CONFIG = { stiffness: 60, damping: 25, mass: 0.5 };
interface StageDimensions {
  width: number;
  height: number;
  isMobile: boolean;
}

function useCameraParallax(
  enabled: boolean,
  container: React.RefObject<HTMLElement | null>,
) {
  const rawX = useMotionValue(0),
    rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING_CONFIG),
    y = useSpring(rawY, SPRING_CONFIG);
  useEffect(() => {
    const el = container.current;
    if (!enabled || !el) {
      rawX.set(0);
      rawY.set(0);
      return;
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      rawX.set(((e.clientX - rect.left) / rect.width - 0.5) * 2);
      rawY.set(((e.clientY - rect.top) / rect.height - 0.5) * 2);
    };
    const reset = () => {
      rawX.set(0);
      rawY.set(0);
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, [enabled, container, rawX, rawY]);
  return { x, y };
}

function TunnelCard({
  card,
  progress,
  pointer,
  total,
  stage,
}: {
  card: TunnelCardData;
  progress: MotionValue<number>;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  total: number;
  stage: StageDimensions;
}) {
  const start = (card.index / total) * 0.45;
  const localProgress = useTransform(progress, [start, start + 0.55], [0, 1]);
  const z = useTransform(localProgress, [0, 1], [-1250, 80]);
  const opacity = useTransform(
    localProgress,
    [0, 0.18, 0.8, 1],
    [0, 0.85, 0.85, 0],
  );
  const width = stage.isMobile
    ? 125
    : Math.max(120, Math.min(180, stage.width * 0.15));
  const baseX =
    Math.sign(card.angleCos) *
    Math.max(
      stage.width * 0.35,
      Math.abs(card.angleCos * stage.width * card.radiusFactorX),
    );
  const baseY = card.angleSin * stage.height * card.radiusFactorY;
  const transform = useTransform(
    [z, pointer.x, pointer.y],
    ([depth, px, py]: number[]) =>
      `translate3d(calc(-50% + ${baseX - px * 18}px), calc(-50% + ${baseY - py * 15}px), ${depth}px) rotateZ(${card.rotationZ}deg)`,
  );
  return (
    <motion.div
      aria-hidden="true"
      className="tunnel-card"
      style={{ width, transform, opacity, zIndex: card.index + 1 }}
    >
      <img
        src={card.item.src}
        alt=""
        draggable={false}
        width="360"
        height="450"
      />
      <span>
        {card.item.title} / {String(card.index + 1).padStart(2, "0")}
      </span>
    </motion.div>
  );
}

export interface PerspectiveTunnelHeroProps {
  onRegister?: () => void;
  onSchedule?: () => void;
  disabled?: boolean;
}

export default function PerspectiveTunnelHero({
  onRegister,
  onSchedule,
  disabled,
}: PerspectiveTunnelHeroProps) {
  const containerRef = useRef<HTMLElement>(null);
  const preferredReducedMotion = useReducedMotion();
  // A stable initial render keeps SSR and hydration identical. Subscribe locally
  // because this Motion version snapshots its preference only when mounted.
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(preferredReducedMotion ?? media.matches);
    const update = () => setReduce(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [preferredReducedMotion]);
  const [stage, setStage] = useState<StageDimensions>({
    width: 1100,
    height: 460,
    isMobile: false,
  });
  const rawProgress = useMotionValue(0.46);
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 80,
    damping: 30,
    restDelta: 0.0001,
  });
  const pointer = useCameraParallax(
    reduce === false && !stage.isMobile,
    containerRef,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ width, height, isMobile: width < 640 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Observe ordinary document scrolling; never intercept wheel, touch or keyboard.
  useEffect(() => {
    if (reduce !== false) return;
    const update = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect)
        rawProgress.set(
          0.46 + Math.min(0.4, Math.max(0, -rect.top / rect.height) * 0.4),
        );
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [reduce, rawProgress]);

  return (
    <section
      ref={containerRef}
      className="tunnel-hero"
      aria-label="นครโกสัมพีเกมส์ ปีการศึกษา 2569"
      data-motion={reduce === false ? "enabled" : "reduced"}
    >
      <div className="tunnel-grid" aria-hidden="true" />
      <div className="tunnel-ring ring-outer" aria-hidden="true" />
      <div className="tunnel-ring ring-inner" aria-hidden="true" />
      <div
        className="tunnel-stage"
        aria-hidden="true"
        style={{
          perspective: stage.isMobile ? "900px" : "1200px",
          transformStyle: "preserve-3d",
        }}
      >
        {reduce === false &&
          TUNNEL_CARDS.map((card) => (
            <TunnelCard
              key={card.index}
              card={card}
              progress={smoothProgress}
              pointer={pointer}
              total={TUNNEL_CARDS.length}
              stage={stage}
            />
          ))}
      </div>
      <div className="hero-photo hero-photo-left" aria-hidden="true">
        <img src={IMAGES[0].src} alt="" width="360" height="450" />
        <span>ATHLETICS / 01</span>
      </div>
      <div className="hero-photo hero-photo-right" aria-hidden="true">
        <img src={IMAGES[1].src} alt="" width="360" height="450" />
        <span>FOOTBALL / 02</span>
      </div>
      <div className="tunnel-copy">
        <p className="hero-eyebrow">
          <span />
          TOGETHER, WE PLAY.
        </p>
        <h2>
          ทุกความพยายาม
          <br />
          คือจุดเริ่มต้นของ<span>ชัยชนะ</span>
        </h2>
        <p className="hero-description">
          นครโกสัมพีเกมส์ ปีการศึกษา 2569
          <br />
          พื้นที่ของความสามารถ น้ำใจนักกีฬา และมิตรภาพ
        </p>
        <div className="hero-actions">
          {onRegister && (
            <Button onClick={onRegister} disabled={disabled}>
              ลงทะเบียนนักกีฬา
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
          {onSchedule && (
            <Button variant="outline" onClick={onSchedule} disabled={disabled}>
              <CalendarDays aria-hidden="true" />
              ดูตารางแข่งขัน
            </Button>
          )}
        </div>
        <p className="hero-signoff">
          <Sparkles aria-hidden="true" />
          ร่วมแข่งขัน เติบโตไปด้วยกัน
        </p>
      </div>
      <div className="hero-year" aria-hidden="true">
        2569
      </div>
    </section>
  );
}
