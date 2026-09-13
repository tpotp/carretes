'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Heart,
  Share2,
  Instagram,
  CheckCircle2,
  Ticket,
} from 'lucide-react';
import { Evento, CATEGORIAS } from '../lib/types';
import { getChileTodayStr, getUserRsvps, toggleRsvp } from '../lib/events-store';

interface EventCardProps {
  evento: Evento;
  onRsvpChange?: () => void;
}

function addDay(dateIso: string): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 12)).toISOString().slice(0, 10);
}

function formatDateFriendly(dateStr: string) {
  const todayStr = getChileTodayStr();
  if (dateStr === todayStr) return '🔥 HOY';
  if (dateStr === addDay(todayStr)) return '⚡ MAÑANA';

  const [year, month, day] = dateStr.split('-').map(Number);
  const eventDate = new Date(Date.UTC(year, month - 1, day, 12));
  const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${dayNames[eventDate.getUTCDay()]} ${day} ${monthNames[month - 1]}`;
}

export default function EventCard({ evento, onRsvpChange }: EventCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const catMeta = CATEGORIAS.find((category) => category.value === evento.categoria);

  useEffect(() => {
    setIsLiked(getUserRsvps().includes(evento.id));
  }, [evento.id]);

  const handleLike = () => {
    const result = toggleRsvp(evento.id);
    setIsLiked(result.interested);
    onRsvpChange?.();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/evento/${evento.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: evento.nombre,
          text: `${evento.nombre} — ${evento.ciudad}`,
          url: shareUrl,
        });
        return;
      } catch {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard puede estar bloqueado; no rompe la tarjeta.
    }
  };

  const priceNode = evento.precio_conocido === false ? (
    <span className="badge badge-paid" style={{ fontSize: '11px', padding: '3px 8px' }}>
      PRECIO POR CONFIRMAR
    </span>
  ) : evento.precio === 0 ? (
    <span className="badge badge-free" style={{ fontSize: '11px', padding: '3px 8px' }}>
      🎉 GRATIS
    </span>
  ) : (
    <span className="badge badge-paid" style={{ fontSize: '11px', padding: '3px 8px' }}>
      ${evento.precio.toLocaleString('es-CL')}
    </span>
  );

  return (
    <article
      className="event-card group"
      style={
        evento.tags?.includes('💎 joyita oculta')
          ? {
              border: '1px solid rgba(236, 72, 153, 0.45)',
              boxShadow: '0 4px 24px -6px rgba(236, 72, 153, 0.3)',
            }
          : undefined
      }
    >
      <div className="event-card-image" style={{ position: 'relative' }}>
        <Link href={`/evento/${evento.id}`} aria-label={`Ver ${evento.nombre}`} style={{ display: 'block', width: '100%', height: '100%' }}>
          <img
            src={
              evento.imagen_url ||
              'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80'
            }
            alt={evento.nombre}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
          />
          <div className="event-card-image-overlay" />
        </Link>

        <div className="event-card-top-badges">
          <span className={`badge ${catMeta?.badgeClass || 'badge-otro'}`} style={{ backdropFilter: 'blur(8px)' }}>
            <span>{catMeta?.emoji}</span>
            <span>{catMeta?.label || evento.categoria}</span>
          </span>

          {evento.tags?.includes('💎 joyita oculta') && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                boxShadow: '0 0 10px rgba(236,72,153,0.5)',
                border: '1px solid rgba(255,255,255,0.4)',
                letterSpacing: '0.05em',
              }}
            >
              💎 JOYITA
            </span>
          )}

          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              background: 'rgba(0,0,0,0.7)',
              color: '#f8fafc',
              padding: '4px 8px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {formatDateFriendly(evento.fecha)}
          </span>
        </div>

        <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px', zIndex: 3 }}>
          <button
            type="button"
            onClick={handleShare}
            title="Compartir carrete"
            aria-label="Compartir carrete"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: copied ? '#10b981' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {copied ? <CheckCircle2 size={15} /> : <Share2 size={15} />}
          </button>
          <button
            type="button"
            onClick={handleLike}
            title={isLiked ? 'Quitar de mis intereses' : 'Me interesa'}
            aria-label={isLiked ? 'Quitar de mis intereses' : 'Me interesa'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: isLiked ? 'rgba(236,72,153,0.9)' : 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              border: isLiked ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Heart size={15} fill={isLiked ? '#fff' : 'none'} />
          </button>
        </div>
      </div>

      <div className="event-card-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a78bfa', fontWeight: 600 }}>
            <Clock size={13} />
            <span>{evento.hora ? `${evento.hora} hrs` : 'Horario por confirmar'}</span>
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 8px',
              borderRadius: '10px',
              whiteSpace: 'nowrap',
            }}
          >
            {evento.ciudad}
          </span>
        </div>

        <Link href={`/evento/${evento.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3 className="event-card-title">{evento.nombre}</h3>
        </Link>

        <div className="event-card-location">
          <MapPin size={14} style={{ color: '#ec4899', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {evento.lugar} {evento.sector ? `· ${evento.sector}` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', minHeight: '24px' }}>
          {priceNode}
          {evento.precio_texto && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {evento.precio_texto}
            </span>
          )}
        </div>

        <div className="event-card-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {evento.fuente === 'instagram' ? (
              <Instagram size={13} style={{ color: '#ec4899' }} />
            ) : evento.fuente === 'passline' ? (
              <Ticket size={13} style={{ color: '#f59e0b' }} />
            ) : (
              <CheckCircle2 size={13} style={{ color: '#10b981' }} />
            )}
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {evento.organizador || 'Comunidad'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: isLiked ? '#ec4899' : 'var(--text-muted)' }}>
            <Heart size={12} fill={isLiked ? '#ec4899' : 'none'} />
            <span>{isLiked ? 'Te interesa' : 'Guardar'}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
