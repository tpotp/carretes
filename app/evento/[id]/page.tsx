'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Heart,
  Share2,
  ExternalLink,
  Instagram,
  CheckCircle2,
  Ticket,
  Navigation,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { Evento, CATEGORIAS } from '../../../lib/types';
import { getStoredEvents, getUserRsvps, toggleRsvp } from '../../../lib/events-store';
import EventCard from '../../../components/EventCard';

interface EventosApiResponse {
  success: boolean;
  eventos?: Evento[];
}

export default function EventoDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [evento, setEvento] = useState<Evento | null>(null);
  const [related, setRelated] = useState<Evento[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      let all = getStoredEvents();
      let found = all.find((event) => event.id === id);

      try {
        const response = await fetch('/api/eventos', { cache: 'no-store' });
        if (response.ok) {
          const payload = (await response.json()) as EventosApiResponse;
          if (payload.success && Array.isArray(payload.eventos)) {
            all = payload.eventos;
            found = all.find((event) => event.id === id) || found;
          }
        }
      } catch {
        // El caché local permite seguir navegando si la API está temporalmente caída.
      }

      if (cancelled) return;
      setEvento(found || null);
      if (found) {
        setIsLiked(getUserRsvps().includes(found.id));
        setRelated(
          all
            .filter(
              (candidate) =>
                candidate.id !== found?.id &&
                (candidate.categoria === found?.categoria || candidate.ciudad === found?.ciudad),
            )
            .slice(0, 3),
        );
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleLike = () => {
    if (!evento) return;
    const result = toggleRsvp(evento.id);
    setIsLiked(result.interested);
  };

  const handleShareWhatsApp = () => {
    if (!evento) return;
    const text = `${evento.nombre} 🔥 ${evento.fecha} · ${evento.lugar || evento.ciudad} 👉 ${window.location.href}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No bloquear la página si el navegador niega clipboard.
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando evento…</p>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Carrete no encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Este evento puede haber finalizado, cambiado o sido retirado.
        </p>
        <Link href="/" className="btn btn-primary">Volver a la cartelera</Link>
      </div>
    );
  }

  const catMeta = CATEGORIAS.find((category) => category.value === evento.categoria);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${evento.lugar || ''}, ${evento.ciudad}, Chile`)}`;
  const priceLabel = evento.precio_conocido === false
    ? 'PRECIO POR CONFIRMAR'
    : evento.precio === 0
      ? '🎉 ENTRADA LIBERADA'
      : `$${evento.precio.toLocaleString('es-CL')}`;

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container">
        <Link
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}
        >
          <ArrowLeft size={16} /> Volver a la cartelera
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '36px', alignItems: 'start' }}>
          <div>
            <div className="glass-card" style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', position: 'relative' }}>
              <img
                src={evento.imagen_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'}
                alt={evento.nombre}
                style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', display: 'block' }}
              />
              <div className="event-card-image-overlay" />
              <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className={`badge ${catMeta?.badgeClass || 'badge-otro'}`}>
                  {catMeta?.emoji} {catMeta?.label || evento.categoria}
                </span>
                <span className="badge" style={{ background: 'rgba(0,0,0,0.72)', color: '#fff' }}>{evento.ciudad}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleLike}
                className="btn btn-outline"
                style={{ flex: 1, justifyContent: 'center', borderColor: isLiked ? '#ec4899' : undefined, background: isLiked ? 'rgba(236,72,153,0.15)' : undefined }}
              >
                <Heart size={16} fill={isLiked ? '#ec4899' : 'none'} color={isLiked ? '#ec4899' : 'currentColor'} />
                <span>{isLiked ? 'Te interesa' : 'Me interesa'}</span>
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="btn btn-outline"
                style={{ flex: 1, justifyContent: 'center', background: 'rgba(37,211,102,0.1)', borderColor: 'rgba(37,211,102,0.3)', color: '#4ade80' }}
              >
                <MessageCircle size={16} /> Compartir por WhatsApp
              </button>
              <button type="button" onClick={handleCopyLink} className="btn btn-ghost" title="Copiar link">
                {copied ? <CheckCircle2 size={16} color="#10b981" /> : <Share2 size={16} />}
              </button>
            </div>
          </div>

          <section className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>{evento.fecha}</span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> {evento.hora ? `${evento.hora} hrs` : 'Horario por confirmar'}
                </span>
              </div>
              <h1 style={{ fontSize: 'clamp(22px, 4vw, 32px)', lineHeight: 1.15 }}>{evento.nombre}</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} color="#ec4899" /> Lugar
                </div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{evento.lugar || 'Por confirmar'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{evento.ciudad}</div>
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <Navigation size={11} /> Abrir en Maps
                </a>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Ticket size={12} color="#f59e0b" /> Entrada
                </div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: evento.precio_conocido === false ? 'var(--text-primary)' : evento.precio === 0 ? '#10b981' : '#f59e0b' }}>
                  {priceLabel}
                </div>
                {evento.precio_texto && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{evento.precio_texto}</div>}
              </div>
            </div>

            {evento.organizador && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Instagram size={20} color="#ec4899" />
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fuente / organizador</div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{evento.organizador}</div>
                  </div>
                </div>
                {evento.organizador_url && (
                  <a href={evento.organizador_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    Ver Instagram <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            <div>
              <h3 style={{ fontSize: '15px', marginBottom: '8px', color: 'var(--text-secondary)' }}>Detalles</h3>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {evento.descripcion || 'Consulta la fuente oficial para confirmar los detalles.'}
              </p>
            </div>

            {evento.fuente_url && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <a href={evento.fuente_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '15px' }}>
                  Ver fuente oficial / entradas <ExternalLink size={16} />
                </a>
              </div>
            )}
          </section>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: '64px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#ec4899" /> Otros carretes que te pueden gustar
            </h3>
            <div className="event-grid">
              {related.map((event) => <EventCard key={event.id} evento={event} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
