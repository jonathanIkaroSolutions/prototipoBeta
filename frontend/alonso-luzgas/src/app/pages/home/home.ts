import { Component, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class Home implements AfterViewInit, OnDestroy {
  @ViewChild('heroSection') heroSection!: ElementRef;

  ngAfterViewInit(): void {
    this.initAnimations();
  }

  ngOnDestroy(): void {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }

  private initAnimations(): void {
    // Hero entrance animation
    const heroTl = gsap.timeline();
    heroTl.from('.hero__tag', { opacity: 0, y: 30, duration: 0.6, ease: 'power3.out' })
      .from('.hero__title', { opacity: 0, y: 40, duration: 0.8, ease: 'power3.out' }, '-=0.3')
      .from('.hero__subtitle', { opacity: 0, y: 30, duration: 0.6, ease: 'power3.out' }, '-=0.4')
      .from('.hero__actions', { opacity: 0, y: 20, duration: 0.5, ease: 'power3.out' }, '-=0.3')
      .from('.hero__badge', { opacity: 0, scale: 0.8, duration: 0.5, ease: 'back.out(1.7)' }, '-=0.2');

    // Marquee partners
    gsap.to('.marquee__track', {
      xPercent: -50,
      duration: 20,
      ease: 'none',
      repeat: -1,
    });

    // Services section reveal
    gsap.utils.toArray('.service-card').forEach((card: any, i: number) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        y: 60,
        duration: 0.7,
        delay: i * 0.1,
        ease: 'power3.out',
      });
    });

    // Stats counter animation
    gsap.utils.toArray('.stat__number').forEach((el: any) => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        textContent: 0,
        duration: 2,
        ease: 'power1.out',
        snap: { textContent: 1 },
        stagger: 0.2,
      });
    });

    // Sections fade in
    gsap.utils.toArray('.animate-section').forEach((section: any) => {
      gsap.from(section, {
        scrollTrigger: {
          trigger: section,
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: 'power3.out',
      });
    });

    // Offices cards stagger
    gsap.utils.toArray('.office-card').forEach((card: any, i: number) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        opacity: 0,
        x: -40,
        duration: 0.6,
        delay: i * 0.15,
        ease: 'power3.out',
      });
    });

    // CTA section
    gsap.from('.cta', {
      scrollTrigger: {
        trigger: '.cta',
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
      opacity: 0,
      scale: 0.95,
      duration: 0.8,
      ease: 'power3.out',
    });
  }
}
