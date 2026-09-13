'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Evento, Categoria, CIUDADES } from '../../lib/types';
import { filterEvents, fetchEventsFromSupabase, getChileTodayStr } from '../../lib/events-store';
import EventCard from '../../components/EventCard';
import SearchBar from '../../components/SearchBar';
import CategoryFilter from '../../components/CategoryFilter';
import DateFilter from '../../components/DateFilter';

function SearchPageContent() {
  const searchParams = useSearchParams();

  const initialCat = (searchParams.get('categoria') as Categoria) || 'todos';
  const initialFecha = (searchParams.get('fecha') as 'todos' | 'hoy' | 'finde' | 'futuro' | 'semana') || 'futuro';
  const initialQ = searchParams.get('q') || '';
  const initialCity = searchParams.get('ciudad') || 'todos';

  const [events, setEvents] = useState<Evento[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [selectedCategory, setSelectedCategory] = useState<Categoria | 'todos'>(initialCat);
  const [selectedCity, setSelectedCity] = useState<string | 'todos'>(initialCity);
  const [selectedDate, setSelectedDate] = useState<'todos' | 'hoy' | 'finde' | 'futuro' | 'semana'>(initialFecha);
  const [selectedPrice, setSelectedPrice] = useState<'todos' | 'gratis' | 'pago'>('todos');

  const loadEvents = async () => {
    const cloudEvents = await fetchEventsFromSupabase();
    setEvents(cloudEvents);
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const todayStr = useMemo(() => getChileTodayStr(), []);
  const todayCount = useMemo(() => events.filter((e) => e.fecha === todayStr).length, [events, todayStr]);
  const futureCount = useMemo(() => events.filter((e) => e.fecha >= todayStr).length, [events, todayStr]);

  const filteredEvents = useMemo(() => {
    return filterEvents(events, {
      busqueda: searchQuery,
      categoria: selectedCategory,
      ciudad: selectedCity,
      fecha: selectedDate,
      precio: selectedPrice,
    });
  }, [events, searchQuery, selectedCategory, selectedCity, selectedDate, selectedPrice]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: events.length };
    events.forEach((e) => {
      counts[e.categoria] = (counts[e.categoria] || 0) + 1;
    });
    return counts;
  }, [events]);

  return (
    <div style={{ padding: '32px 0 80px' }}>
      <div className="container">
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginBottom: '16px',
            }}
          >
            <ArrowLeft size={16} />
            <span>Volver al inicio</span>
          </Link>

          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: '8px' }}>
            Explorar carretes
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Busca por local, comuna, estilo o fecha.
          </p>
        </div>

        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        <div style={{ marginTop: '20px' }}>
          <CategoryFilter
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            counts={categoryCounts}
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <DateFilter
            selected={selectedDate}
            onSelect={setSelectedDate}
            todayCount={todayCount}
            futureCount={futureCount}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '18px' }}>
          <select className="form-select" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} style={{ maxWidth: '220px' }}>
            <option value="todos">Toda la V Región</option>
            {CIUDADES.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select className="form-select" value={selectedPrice} onChange={(e) => setSelectedPrice(e.target.value as 'todos' | 'gratis' | 'pago')} style={{ maxWidth: '220px' }}>
            <option value="todos">Cualquier precio</option>
            <option value="gratis">Gratis</option>
            <option value="pago">De pago</option>
          </select>
        </div>

        <div style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '20px' }}>Resultados</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{filteredEvents.length} eventos</span>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="event-grid">
              {filteredEvents.map((event) => <EventCard key={event.id} evento={event} />)}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '36px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '8px' }}>No encontramos eventos con esos filtros</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Prueba ampliar la fecha, comuna o categoría.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: '80px 0' }}>Cargando explorador…</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
