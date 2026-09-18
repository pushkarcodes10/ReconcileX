"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type ScrollTriggerTarget = string | Element;

export function createScrollAnimation(
  element: gsap.TweenTarget,
  animation: gsap.TweenVars,
  trigger: string | Element,
  options: ScrollTrigger.Vars = {}
) {
  return gsap.to(element, {
    ...animation,
    scrollTrigger: {
      trigger,
      start: "top 80%",
      end: "bottom 20%",
      toggleActions: "play none none reverse",
      ...options,
    },
  });
}

export function createStaggerAnimation(
  elements: gsap.TweenTarget,
  animation: gsap.TweenVars,
  trigger: string | Element,
  stagger = 0.1,
  options: ScrollTrigger.Vars = {}
) {
  return gsap.to(elements, {
    ...animation,
    stagger,
    scrollTrigger: {
      trigger,
      start: "top 80%",
      end: "bottom 20%",
      toggleActions: "play none none reverse",
      ...options,
    },
  });
}

export function createPinAnimation(
  element: gsap.TweenTarget,
  animation: gsap.TweenVars,
  trigger: string | Element,
  options: ScrollTrigger.Vars = {}
) {
  return gsap.to(element, {
    ...animation,
    scrollTrigger: {
      trigger,
      start: "top top",
      end: "bottom bottom",
      pin: true,
      pinSpacing: true,
      scrub: 1,
      ...options,
    },
  });
}

export function createScrubAnimation(
  element: gsap.TweenTarget,
  animation: gsap.TweenVars,
  trigger: string | Element,
  options: ScrollTrigger.Vars = {}
) {
  return gsap.to(element, {
    ...animation,
    scrollTrigger: {
      trigger,
      start: "top bottom",
      end: "bottom top",
      scrub: 1,
      ...options,
    },
  });
}

export function initAnimations() {
  ScrollTrigger.refresh();
}

export function killAllScrollTriggers() {
  ScrollTrigger.getAll().forEach((st) => st.kill());
}