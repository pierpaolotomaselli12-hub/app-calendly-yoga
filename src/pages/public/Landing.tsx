import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import anime from 'animejs'
import { useApp } from '../../context/AppContext'
import { LESSONS_PATH } from '../../lib/navigation'
import logoFull from '../../assets/logo-full.png'
import './Landing.css'

/* ──────────────────────────────────────────────────────────────
   Landing di laurapagnossin.it (home "/").
   Pulsante principale: prova gratuita su WhatsApp.
   Pulsanti secondari: area lezioni, accedi, registrati.
   I testi tra [parentesi quadre] sono placeholder da sostituire.
   ────────────────────────────────────────────────────────────── */

const WA_NUMBER = '393425211458' // +39 342 521 1458
const ADDRESS = '[Via e numero], Porcia (PN)' // TODO: indirizzo della sala

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

function waLink(slot?: string): string {
  const text = slot
    ? `Ciao Laura, vorrei prenotare la lezione di prova gratuita di ${slot}.`
    : 'Ciao Laura, vorrei prenotare la lezione di prova gratuita. Quali orari hai liberi?'
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`
}

function trackContact() {
  window.fbq?.('track', 'Contact')
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const SCHEDULE = [
  { day: 'Lunedì', slots: [
    { time: '9:15 – 10:15', part: 'Mattina', value: 'lunedì alle 9:15' },
    { time: '18:30 – 19:30', part: 'Sera', value: 'lunedì alle 18:30' },
  ] },
  { day: 'Giovedì', slots: [
    { time: '18:20 – 19:20', part: 'Sera', value: 'giovedì alle 18:20' },
    { time: '19:30 – 20:30', part: 'Sera', value: 'giovedì alle 19:30' },
  ] },
]

const FOR_WHO: { icon: string; text: string }[] = [
  { icon: 'M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM12 8v6M8 21l4-7 4 7M7 11h10', text: 'Non hai mai fatto yoga e non sai da dove partire.' },
  { icon: 'M4 18h16M6 18V9h12v9M9 9V6h6v3', text: 'Passi tante ore seduto o in piedi e la sera la schiena si fa sentire.' },
  { icon: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16ZM12 7v5l3 2', text: 'Lavori su turni e ti serve un orario al mattino o alla sera.' },
  { icon: 'M3 12h4l2-5 4 10 2-5h6', text: "Cerchi un'ora fissa nella settimana per staccare la testa." },
  { icon: 'M8 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM16 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5', text: 'Vuoi conoscere gente nuova qui in zona.' },
]

const FAQ = [
  { q: 'Non ho mai fatto yoga. Posso venire?', a: 'Sì. La prova serve proprio a capire se ti trovi bene. Scrivimi che è la tua prima volta e ti seguo io.' },
  { q: 'Lavoro su turni. Come faccio?', a: 'Ci sono 4 orari: lunedì alle 9:15 e alle 18:30, giovedì alle 18:20 e alle 19:30. Mandami i tuoi turni e troviamo insieme la fascia che ti va bene.' },
  { q: 'Quanto costa dopo la prova?', a: 'Te lo spiego a fine lezione, con i pacchetti disponibili. La prova è gratuita e non ti impegna a niente.' },
  { q: 'Posso venire solo ogni tanto?', a: 'Sì. Dopo la prova ti mostro le formule, anche quelle con i giorni liberi.' },
  { q: 'Cosa devo portare?', a: "Un abbigliamento comodo. [Tappetino: c'è in sala o va portato?]" },
  { q: 'Quante persone ci sono a lezione?', a: 'Al massimo 15. Per questo i posti vanno prenotati.' },
  { q: 'Sono già iscritto. Dove prenoto le lezioni?', a: "Nell'area lezioni: accedi con la tua email e scegli la lezione dal calendario." },
]

const REVIEWS = [
  { quote: "[Frase vera di un'iscritta o un iscritto, presa da un messaggio WhatsApp]", who: '[Nome, da quanto pratica]', initial: 'A' },
  { quote: '[Seconda testimonianza: meglio se parla della prima lezione]', who: '[Nome, da quanto pratica]', initial: 'B' },
  { quote: '[Terza testimonianza: meglio se parla della schiena o dello stress]', who: '[Nome, da quanto pratica]', initial: 'C' },
]

/** Evidenzia i placeholder [tra parentesi quadre]. */
function Txt({ children }: { children: string }) {
  const parts = children.split(/(\[[^\]]+\])/g)
  return <>{parts.map((p, i) => p.startsWith('[') ? <span key={i} className="lp-todo">{p}</span> : p)}</>
}

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
  )
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></svg>
}

function WaButton({ slot, label, className = '' }: { slot?: string; label: string; className?: string }) {
  return (
    <a className={`lp-btn lp-magnet ${className}`} href={waLink(slot)} target="_blank" rel="noopener noreferrer" onClick={trackContact}>
      <span className="lp-btn__ico"><WaIcon /></span>{label}
    </a>
  )
}

/* ── Sfondo a linee della hero (porting di Kokonut UI "background-paths") ── */
function PathsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const hero = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !hero || !ctx) return
    const reduce = reducedMotion()
    const LAYERS = [
      { w: 1, o: .12, ph: .6, pace: .7, part: .45 },
      { w: 1.2, o: .2, ph: .3, pace: .85, part: .75 },
      { w: 1.4, o: .3, ph: 0, pace: 1, part: 1 },
    ]
    const COUNT = 30, SAMPLES = 64, OVER = .06, SLOPE = Math.tan(-8 * Math.PI / 180)
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-green').trim() || '#818569'
    const ptr = { x: 0, y: 0, amt: 0, on: false }
    let W = 0, H = 0, raf = 0, visible = true
    const t0 = performance.now()

    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = hero.clientWidth; H = hero.clientHeight
      canvas.width = W * dpr; canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const lineY = (s: number, u: number, L: typeof LAYERS[number], time: number, band: number) => {
      const t = time * L.pace, x = u * W
      const center = H * .55 + SLOPE * (x - W / 2) + band * .1 * Math.sin(Math.PI * 2 * (.75 * u + .1) + L.ph + t * .35)
      const turn = .22 + .09 * Math.sin(t * .21 + L.ph), breathe = .3 * Math.sin(t * .5 + s * 4 + L.ph)
      return center + s * band * .8 * Math.cos(Math.PI * (u - turn) + s * (.6 + breathe) + L.ph)
    }
    const part = (x: number, y: number, str: number) => {
      if (ptr.amt < .001) return y
      const dx = x - ptr.x, dy = y - ptr.y, f = Math.exp(-(dx * dx + dy * dy) / (150 * 150))
      return y + (dy / (Math.abs(dy) + 24)) * f * 48 * str * ptr.amt
    }
    const draw = (now: number) => {
      const elapsed = now - t0, time = reduce ? 0 : elapsed / 1000 * .35
      ptr.amt += ((ptr.on ? 1 : 0) - ptr.amt) * .08
      ctx.clearRect(0, 0, W, H); ctx.strokeStyle = color; ctx.lineCap = 'round'
      const band = Math.min(H, W * 1.1) * .7, per = Math.round(COUNT / 3)
      LAYERS.forEach((L, li) => {
        ctx.lineWidth = L.w
        for (let i = 0; i < per; i++) {
          let d = reduce ? 1 : Math.max(0, Math.min(1, (elapsed - (li * per + i) * 35) / 1400))
          d = 1 - Math.pow(1 - d, 3)
          if (d <= 0) continue
          const s = i / (per - 1) - .5, last = Math.max(1, Math.ceil(SAMPLES * d))
          let px = 0, py = 0
          ctx.globalAlpha = L.o * (.45 + .55 * (1 - Math.abs(s) * 2))
          ctx.beginPath()
          for (let k = 0; k <= last; k++) {
            const u = -OVER + (k / SAMPLES) * (1 + OVER * 2), x = u * W, y = part(x, lineY(s, u, L, time, band), L.part)
            if (k === 0) ctx.moveTo(x, y); else ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
            px = x; py = y
          }
          ctx.lineTo(px, py); ctx.stroke()
        }
      })
      ctx.globalAlpha = 1
    }
    const loop = (now: number) => { if (visible) draw(now); raf = requestAnimationFrame(loop) }
    const onMove = (e: PointerEvent) => { const r = hero.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true }
    const onLeave = () => { ptr.on = false }
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting })

    size()
    window.addEventListener('resize', size)
    hero.addEventListener('pointermove', onMove)
    hero.addEventListener('pointerleave', onLeave)
    io.observe(hero)
    if (reduce) draw(performance.now()); else raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf); io.disconnect()
      window.removeEventListener('resize', size)
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
    }
  }, [])
  return <canvas ref={ref} className="lp-paths" aria-hidden="true" />
}

/* ── Scelta dell'orario ── */
function SlotPicker() {
  const [picked, setPicked] = useState('lunedì alle 18:30')
  const pickedRef = useRef<HTMLElement>(null)
  function choose(value: string) {
    setPicked(value)
    if (!reducedMotion() && pickedRef.current) {
      anime.remove(pickedRef.current)
      anime({ targets: pickedRef.current, opacity: [0, 1], translateY: [10, 0], duration: 450, easing: 'easeOutCubic' })
    }
  }
  return (
    <div className="lp-panel" data-reveal>
      <div className="lp-days">
        {SCHEDULE.map(d => (
          <div key={d.day}>
            <h3 className="lp-day__title">{d.day}</h3>
            <div className="lp-slots">
              {d.slots.map(s => (
                <button key={s.value} type="button" className="lp-slot" aria-pressed={picked === s.value} onClick={() => choose(s.value)}>
                  <span><b>{s.time}</b><small>{s.part}</small></span>
                  <span className="lp-slot__dot"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg></span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="lp-pick">
        <p>Hai scelto<b ref={pickedRef}>{picked.charAt(0).toUpperCase() + picked.slice(1)}</b></p>
        <WaButton slot={picked} label="Prenota la prova gratuita in questo orario" />
      </div>
    </div>
  )
}

/* ── Testimonianze a pila: freccia, trascinamento, scorrimento automatico ── */
function ReviewStack() {
  const [order, setOrder] = useState(REVIEWS.map((_, i) => i))
  const [drag, setDrag] = useState(0)
  const [fly, setFly] = useState(0)
  const dragging = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const paused = useRef(false)
  const busy = useRef(false)
  const reduce = reducedMotion()

  function advance(dir: number) {
    if (busy.current) return
    busy.current = true
    setFly(dir)
    window.setTimeout(() => {
      setOrder(o => [...o.slice(1), o[0]])
      setFly(0); setDrag(0)
      window.setTimeout(() => { busy.current = false }, 200)
    }, reduce ? 0 : 340)
  }

  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => { if (!paused.current && !document.hidden) advance(1) }, 6000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const front = order[0]
  return (
    <>
      <div className="lp-stack-nav">
        <button className="lp-round" type="button" aria-label="Testimonianza successiva" onClick={() => advance(1)}>
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
        <span className="lp-count">{front + 1} / {REVIEWS.length}</span>
        <span className="lp-hint">oppure trascina la card</span>
      </div>
      <div
        className="lp-stack"
        aria-live="polite"
        onPointerEnter={() => { paused.current = true }}
        onPointerLeave={() => { paused.current = false }}
      >
        {order.map((ri, pos) => {
          const r = REVIEWS[ri]
          const isFront = pos === 0
          let transform = `translateY(${pos * 16}px) scale(${1 - pos * .045}) rotate(${pos === 0 ? 0 : pos % 2 ? 1.6 : -1.4}deg)`
          let opacity = 1 - pos * .18
          if (isFront && fly) { transform = `translateX(${fly * 420}px) translateY(-30px) rotate(${fly * 14}deg)`; opacity = 0 }
          else if (isFront && drag) transform = `translateX(${drag}px) rotate(${drag / 18}deg)`
          return (
            <article
              key={ri}
              className={`lp-card${isFront && isDragging ? ' is-dragging' : ''}`}
              style={{ transform, opacity, zIndex: 10 - pos }}
              aria-hidden={!isFront}
              onPointerDown={isFront ? e => { dragging.current = true; setIsDragging(true); startX.current = e.clientX; paused.current = true; e.currentTarget.setPointerCapture(e.pointerId) } : undefined}
              onPointerMove={isFront ? e => { if (dragging.current) setDrag(e.clientX - startX.current) } : undefined}
              onPointerUp={isFront ? () => { dragging.current = false; setIsDragging(false); paused.current = false; if (Math.abs(drag) > 80) advance(drag > 0 ? 1 : -1); else setDrag(0) } : undefined}
              onPointerCancel={isFront ? () => { dragging.current = false; setIsDragging(false); setDrag(0) } : undefined}
            >
              <p className="lp-card__quote"><Txt>{r.quote}</Txt></p>
              <div className="lp-who"><i>{r.initial}</i><span><Txt>{r.who}</Txt></span></div>
            </article>
          )
        })}
      </div>
    </>
  )
}

/* ── Mappa e indirizzo ── */
function PlaceCard() {
  const mapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [copied, setCopied] = useState('')
  const addrRef = useRef<HTMLParagraphElement>(null)
  const q = encodeURIComponent(ADDRESS)

  async function copy() {
    try {
      await navigator.clipboard.writeText(ADDRESS)
      setCopied('Indirizzo copiato. Incollalo nel navigatore.')
    } catch {
      const el = addrRef.current
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r) }
      setCopied('Indirizzo selezionato: premi Copia.')
    }
  }

  useEffect(() => {
    const map = mapRef.current, svg = svgRef.current
    if (!map || !svg || reducedMotion()) return
    const onMove = (e: PointerEvent) => {
      const r = map.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5
      svg.style.transform = `perspective(900px) rotateX(${-y * 7}deg) rotateY(${x * 9}deg) translate(${-x * 10}px,${-y * 8}px)`
    }
    const onLeave = () => { svg.style.transform = '' }
    map.addEventListener('pointermove', onMove)
    map.addEventListener('pointerleave', onLeave)
    let io: IntersectionObserver | null = null
    if (map.getBoundingClientRect().top > window.innerHeight * 1.12) {
      io = new IntersectionObserver(es => {
        if (!es[0].isIntersecting) return
        io?.disconnect()
        anime({ targets: svg.querySelectorAll('.lp-st'), strokeDashoffset: [anime.setDashoffset, 0], duration: 1300, delay: anime.stagger(140), easing: 'easeInOutSine' })
        anime({ targets: svg.querySelector('.lp-route'), strokeDashoffset: [anime.setDashoffset, 0], duration: 1400, delay: 700, easing: 'easeInOutCubic' })
        anime({ targets: svg.querySelector('.lp-pin'), translateY: [-70, 0], opacity: [0, 1], duration: 1200, delay: 1800, easing: 'spring(1, 80, 9, 0)' })
      }, { rootMargin: '0px 0px 12% 0px' })
      io.observe(map)
    }
    return () => { io?.disconnect(); map.removeEventListener('pointermove', onMove); map.removeEventListener('pointerleave', onLeave) }
  }, [])

  return (
    <div className="lp-place" data-reveal>
      <div className="lp-map" ref={mapRef} aria-hidden="true">
        <svg ref={svgRef} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
          <path className="lp-park" d="M262 196c34-24 96-12 116 22s-12 74-64 74-84-60-52-96Z" />
          <rect className="lp-blk" x="20" y="20" width="110" height="80" rx="12" />
          <rect className="lp-blk" x="180" y="10" width="100" height="70" rx="12" />
          <rect className="lp-blk" x="30" y="150" width="90" height="55" rx="12" />
          <rect className="lp-blk" x="250" y="125" width="60" height="55" rx="12" />
          <rect className="lp-blk" x="340" y="20" width="70" height="90" rx="12" />
          <path className="lp-st" strokeWidth="16" d="M-10 122 C 90 108, 180 144, 410 100" />
          <path className="lp-st" strokeWidth="11" d="M150 -10 C 160 80, 220 160, 240 310" />
          <path className="lp-st" strokeWidth="8" d="M-10 226 L 410 252" />
          <path className="lp-st" strokeWidth="7" d="M318 -10 L 332 310" />
          <path className="lp-st" strokeWidth="5" d="M70 -10 L 86 310" />
          <path className="lp-route" d="M24 290 C 70 240, 120 214, 184 186 S 222 156, 226 146" />
          <circle className="lp-pulse" cx="226" cy="146" r="9" />
          <g className="lp-pin"><path className="lp-pin__body" d="M226 146c0 0-15-16-15-27a15 15 0 0 1 30 0c0 11-15 27-15 27Z" /><circle className="lp-pin__dot" cx="226" cy="119" r="5.5" /></g>
        </svg>
        <span className="lp-map__tag">Mappa indicativa</span>
      </div>
      <div className="lp-place__info">
        <p className="lp-addr" ref={addrRef}><Txt>{ADDRESS.replace(', Porcia (PN)', '')}</Txt><small>Porcia (PN)</small></p>
        <div className="lp-actions">
          <a className="lp-pill lp-pill--primary" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24"><path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>Google Maps
          </a>
          <a className="lp-pill" href={`https://maps.apple.com/?q=${q}`} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8-8-2Z" /></svg>Apple Maps
          </a>
          <button className="lp-pill" type="button" onClick={copy}>
            <svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></svg>Copia indirizzo
          </button>
        </div>
        <p className="lp-copied" aria-live="polite">{copied}</p>
      </div>
    </div>
  )
}

function FaqList() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="lp-faq">
      {FAQ.map((f, i) => (
        <div key={f.q} className={`lp-q${open === i ? ' is-open' : ''}`} data-reveal>
          <button type="button" aria-expanded={open === i} aria-controls={`lp-a-${i}`} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}
            <span className="lp-q__plus"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></span>
          </button>
          <div className="lp-a" id={`lp-a-${i}`} role="region">
            <div><p><Txt>{f.a}</Txt></p></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Landing() {
  const { currentStudent } = useApp()
  const rootRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    document.title = 'Yoga a Porcia | Laura Pagnossin'
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Animazioni con anime.js: entrata della hero, comparsa allo scroll, pulsanti magnetici */
  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    anime.timeline({ easing: 'easeOutExpo' })
      .add({ targets: root.querySelectorAll('.lp-h1 .lp-in'), translateY: ['105%', 0], duration: 1100, delay: anime.stagger(120) })
      .add({ targets: root.querySelectorAll('.lp-hero__text [data-in]'), opacity: [0, 1], translateY: [18, 0], duration: 800, delay: anime.stagger(120) }, '-=700')
      .add({ targets: root.querySelector('.lp-hero__media .lp-media'), opacity: [0, 1], scale: [.94, 1], duration: 1100 }, 250)
      .add({ targets: root.querySelectorAll('.lp-chip'), opacity: [0, 1], translateY: [20, 0], scale: [.9, 1], duration: 900, delay: anime.stagger(180), easing: 'spring(1, 80, 12, 0)' }, 900)

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        io.unobserve(e.target)
        const i = Array.prototype.indexOf.call(e.target.parentNode?.children ?? [], e.target)
        anime({ targets: e.target, opacity: [0, 1], translateY: [28, 0], duration: 900, delay: Math.min(i, 5) * 70, easing: 'easeOutCubic' })
      })
    }, { rootMargin: '0px 0px 12% 0px' })
    const vh = window.innerHeight
    root.querySelectorAll('[data-reveal]').forEach(el => { if (el.getBoundingClientRect().top > vh * 1.12) io.observe(el) })

    const cleanups: (() => void)[] = []
    root.querySelectorAll<HTMLElement>('.lp-magnet').forEach(b => {
      const move = (e: PointerEvent) => {
        const r = b.getBoundingClientRect()
        anime.remove(b)
        anime({ targets: b, translateX: (e.clientX - r.left - r.width / 2) * .2, translateY: (e.clientY - r.top - r.height / 2) * .3, duration: 300, easing: 'easeOutQuad' })
      }
      const leave = () => { anime.remove(b); anime({ targets: b, translateX: 0, translateY: 0, duration: 900, easing: 'spring(1, 90, 12, 0)' }) }
      b.addEventListener('pointermove', move); b.addEventListener('pointerleave', leave)
      cleanups.push(() => { b.removeEventListener('pointermove', move); b.removeEventListener('pointerleave', leave) })
    })
    return () => { io.disconnect(); cleanups.forEach(c => c()) }
  }, [])

  return (
    <div className="lp" ref={rootRef}>
      <nav className={`lp-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="lp-wrap">
          <div className="lp-nav__in">
            <Link to="/" className="lp-brand" aria-label="Laura Pagnossin, home"><img src={logoFull} alt="Laura Pagnossin" /></Link>
            <div className="lp-nav__links"><a href="#orari">Orari</a><a href="#lezioni">Le lezioni</a><a href="#laura">Chi sono</a><a href="#dove">Dove</a></div>
            <div className="lp-nav__cta">
              {/* Chi ha già la sessione aperta salta il login e va dritto all'area lezioni */}
              <Link to={currentStudent ? LESSONS_PATH : '/accedi'} className="lp-login" aria-label="Accedi">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg><span className="lp-t">Accedi</span>
              </Link>
              <a className="lp-btn lp-btn--sm" href={waLink()} target="_blank" rel="noopener noreferrer" onClick={trackContact} aria-label="Prenota la prova su WhatsApp">
                <span className="lp-btn__ico"><WaIcon /></span><span className="lp-t">Prenota la prova</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="lp-hero" id="top">
        <PathsCanvas />
        <div className="lp-wrap lp-hero__grid">
          <div className="lp-hero__text">
            <h1 className="lp-h1" aria-label="Yoga a Porcia">
              <span className="lp-line"><span className="lp-in">Yoga</span></span>
              <span className="lp-line"><span className="lp-in"><span className="lp-acc">a</span> Porcia</span></span>
            </h1>
            <p className="lp-lead" data-in>Ciao, sono Laura. Insegno yoga in sala il lunedì e il giovedì, <strong>in gruppi di massimo 15 persone</strong>. La prima lezione è gratuita: scrivimi su WhatsApp e scegli l'orario.</p>
            <div data-in><WaButton label="Prenota la prova su WhatsApp" /></div>
          </div>
          <div className="lp-hero__media">
            <div className="lp-media lp-media--video" role="img" aria-label="Segnaposto video">
              <div className="lp-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg></div>
              <span>Video verticale: Laura si presenta</span>
              <small>20-30 secondi, girato col telefono</small>
            </div>
            <div className="lp-chip lp-chip--1"><i><svg viewBox="0 0 24 24"><path d="M8 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM16 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5" /></svg></i><span><b>15 persone</b>al massimo per classe</span></div>
            <div className="lp-chip lp-chip--2"><i><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></i><span><b>Prima lezione</b>gratuita</span></div>
          </div>
        </div>
      </header>

      <div className="lp-marquee" aria-label="Orari: lunedì 9:15 e 18:30, giovedì 18:20 e 19:30">
        <div className="lp-track" aria-hidden="true">
          {[0, 1].map(k => (
            <span key={k} className="lp-track__set">
              <span>Lunedì <em>9:15</em></span><span>Lunedì <em>18:30</em></span><span>Giovedì <em>18:20</em></span><span>Giovedì <em>19:30</em></span><span>Prima lezione <em>gratuita</em></span>
            </span>
          ))}
        </div>
      </div>

      <main>
        <section className="lp-sec" id="per-chi">
          <div className="lp-wrap">
            <div className="lp-head" data-reveal><h2>Fa per te <span className="lp-acc">se ti riconosci</span> qui</h2></div>
            <div className="lp-rows">
              {FOR_WHO.map(r => (
                <div key={r.text} className="lp-row" data-reveal>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={r.icon} /></svg><p>{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec lp-sec--tight" id="orari">
          <div className="lp-wrap">
            <div className="lp-head" data-reveal>
              <h2>Scegli <span className="lp-acc">il tuo</span> orario</h2>
              <p className="lp-sub">Seleziona l'orario che preferisci e premi "Prenota la prova gratuita in questo orario". Si apre WhatsApp con un messaggio per me già scritto, con il giorno e l'ora che hai scelto. Ti basta premere invia.</p>
            </div>
            <SlotPicker />
          </div>
        </section>

        <section className="lp-sec lp-sec--tight" id="lezioni">
          <div className="lp-wrap">
            <div className="lp-head" data-reveal><h2>Cosa trovi <span className="lp-acc">in sala</span></h2></div>
            <div className="lp-bento">
              <div className="lp-tile lp-media lp-media--photo lp-tile--photo" data-reveal role="img" aria-label="Segnaposto foto"><CameraIcon /><span>Foto: la sala pronta, con i tappetini stesi</span></div>
              <div className="lp-tile lp-tile--green" data-reveal><span className="lp-num">60′</span><h3>Un'ora piena</h3><p>Di pratica guidata, dall'inizio alla fine.</p></div>
              <div className="lp-tile" data-reveal><span className="lp-num">15</span><h3>Persone al massimo</h3><p>Vi vedo tutti e correggo quando serve.</p></div>
              <div className="lp-tile lp-tile--wide" data-reveal><h3>Si parte dal tuo livello</h3><p>Alla prima lezione dimmelo: ti mostro come adattare le posizioni.</p></div>
              <div className="lp-tile lp-tile--wide" data-reveal><h3><Txt>[Stile di yoga]</Txt></h3><p><Txt>[1 riga su come sono le mie lezioni]</Txt></p></div>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-sec--tight" id="laura">
          <div className="lp-wrap lp-about">
            <div className="lp-media lp-media--photo lp-portrait" data-reveal role="img" aria-label="Segnaposto foto"><CameraIcon /><span>Foto di Laura, in sala o all'aperto</span></div>
            <div className="lp-about__text" data-reveal>
              <h2>Laura <span className="lp-acc">Pagnossin</span></h2>
              <p className="lp-role">Insegno yoga a Porcia</p>
              <p><Txt>[Paragrafo 1: come ho iniziato con lo yoga, in 2-3 righe]</Txt></p>
              <p><Txt>[Paragrafo 2: perché ho aperto le lezioni a Porcia e a cosa sto attenta in sala]</Txt></p>
              <ul className="lp-creds">
                <li><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="5" /><path d="M9 13l-2 8 5-3 5 3-2-8" /></svg><Txt>[La mia formazione]</Txt></li>
                <li><svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10" /></svg><Txt>[Da quanto insegno]</Txt></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-sec--tight" id="voci">
          <div className="lp-wrap lp-reviews">
            <div className="lp-head lp-head--flush" data-reveal>
              <h2>Le parole di chi <span className="lp-acc">pratica con me</span></h2>
            </div>
            <div><ReviewStack /></div>
          </div>
        </section>

        <section className="lp-sec lp-sec--tight" id="dove">
          <div className="lp-wrap">
            <div className="lp-head" data-reveal><h2>La <span className="lp-acc">sala</span></h2></div>
            <PlaceCard />
            <div className="lp-media lp-media--photo lp-entrance" data-reveal role="img" aria-label="Segnaposto foto"><CameraIcon /><span>Foto: l'ingresso della sala visto dalla strada</span></div>
          </div>
        </section>

        <section className="lp-sec lp-sec--tight" id="faq">
          <div className="lp-wrap lp-faq-grid">
            <div className="lp-head" data-reveal>
              <h2>Prima della <span className="lp-acc">lezione</span></h2>
              <p className="lp-sub">Se hai un dubbio che qui non trovi, scrivimi su WhatsApp.</p>
            </div>
            <FaqList />
          </div>
        </section>

        <section className="lp-sec lp-sec--tight">
          <div className="lp-wrap">
            <div className="lp-final" data-reveal>
              <h2>Scegli l'orario e <span className="lp-acc">vieni a provare</span></h2>
              <WaButton label="Prenota la prova su WhatsApp" className="lp-btn--light" />
              <p className="lp-final__note">La prima lezione è gratuita.</p>
              <p className="lp-final__members">Sei già iscritto? <Link to={LESSONS_PATH}>Vai alle lezioni</Link></p>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <span>© 2026 Laura Pagnossin · Yoga a Porcia</span>
          <span>
            <Link to={LESSONS_PATH}>Area lezioni</Link> · <Link to="/accedi">Accedi</Link> · <Link to="/registrati">Registrati</Link> · <a href="#">Privacy</a> · <a href="#">Cookie</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
