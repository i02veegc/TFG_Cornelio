'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import styles from './page.module.css';
import { useObrasLive } from '@/hooks/useObrasLive';
import { onMqttStatus, onEspStatus } from '@/lib/mqttClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" fill="%23e9ecef"/><text x="50%25" y="50%25" font-family="sans-serif" font-size="10" fill="%236c757d" text-anchor="middle" dominant-baseline="middle">N/A</text></svg>';

function formatPrecio(precio) {
  if (precio == null) return '—';
  const num = typeof precio === 'string' ? parseFloat(precio) : precio;
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatFecha(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`${styles.statCard} ${accent ? styles[`accent_${accent}`] : ''}`}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );
}

function StatusDot({ ok, label }) {
  return (
    <div className={styles.statusItem}>
      <span
        className={`${styles.statusDot} ${ok ? styles.statusOk : styles.statusBad}`}
        aria-hidden="true"
      />
      <span className={styles.statusLabel}>{label}</span>
      <Badge bg={ok ? 'success' : 'secondary'} className={styles.statusBadge}>
        {ok ? 'Online' : 'Offline'}
      </Badge>
    </div>
  );
}

export default function HomePage() {
  const [obras, setObras] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [mqttOnline, setMqttOnline] = useState(false);
  const [espOnline, setEspOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${API_URL}/api/obras`),
      axios.get(`${API_URL}/api/ventas`),
    ])
      .then(([resObras, resVentas]) => {
        if (cancelled) return;
        setObras(resObras.data);
        setVentas(resVentas.data);
        setApiOnline(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Error cargando datos');
          setApiOnline(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubMqtt = onMqttStatus(setMqttOnline);
    const unsubEsp  = onEspStatus(setEspOnline);
    return () => { unsubMqtt(); unsubEsp(); };
  }, []);

  // Sincronización en vivo: cuando entra una venta vía MQTT, refetch ambos
  // para que KPIs y "Últimas ventas" reflejen el cambio al instante.
  useObrasLive(() => {
    Promise.all([
      axios.get(`${API_URL}/api/obras`),
      axios.get(`${API_URL}/api/ventas`),
    ])
      .then(([resO, resV]) => {
        setObras(resO.data);
        setVentas(resV.data);
      })
      .catch((err) => console.warn('[dashboard] refetch falló:', err.message));
  });

  const stats = useMemo(() => {
    const total = obras.length;
    const vendidas = obras.filter((o) => o.vendido).length;
    const disponibles = total - vendidas;
    const ingresos = ventas.reduce(
      (sum, v) => sum + (parseFloat(v.precio_venta) || 0),
      0
    );
    const pctVendidas = total > 0 ? Math.round((vendidas / total) * 100) : 0;
    return { total, vendidas, disponibles, ingresos, pctVendidas };
  }, [obras, ventas]);

  const ultimasVentas = useMemo(() => ventas.slice(0, 5), [ventas]);

  const destacadas = useMemo(() => {
    return [...obras]
      .filter((o) => !o.vendido)
      .sort((a, b) => parseFloat(b.precio || 0) - parseFloat(a.precio || 0))
      .slice(0, 4);
  }, [obras]);

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <strong>No se pudieron cargar los datos.</strong> {error}
      </Alert>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Inicio</h1>
      <p className={styles.subtitle}>Panel general del Metaverso TFG</p>

      <Row className="g-3 mb-4">
        <Col xs={6} md={3}>
          <StatCard label="Total obras" value={stats.total} />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Disponibles" value={stats.disponibles} accent="green" />
        </Col>
        <Col xs={6} md={3}>
          <StatCard
            label="Vendidas"
            value={stats.vendidas}
            sub={`${stats.pctVendidas}% del total`}
            accent="red"
          />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Ingresos totales" value={formatPrecio(stats.ingresos)} />
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={7}>
          <div className={styles.widget}>
            <div className={styles.widgetHeader}>
              <h2 className={styles.widgetTitle}>Últimas ventas</h2>
              <Link href="/ventas" className={styles.widgetLink}>
                Ver todas <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
            {ultimasVentas.length === 0 ? (
              <div className={styles.empty}>Aún no se han registrado ventas.</div>
            ) : (
              <ul className={styles.ventasList}>
                {ultimasVentas.map((v) => (
                  <li key={v.id} className={styles.ventaItem}>
                    <img
                      src={v.imagen_url || PLACEHOLDER}
                      alt={v.titulo}
                      className={styles.ventaThumb}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                    <div className={styles.ventaMain}>
                      <div className={styles.ventaTitle}>{v.titulo}</div>
                      <div className={styles.ventaSub}>
                        {v.comprador_nombre || '—'} · {formatFecha(v.fecha_venta)}
                      </div>
                    </div>
                    <div className={styles.ventaPrecio}>
                      {formatPrecio(v.precio_venta)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Col>

        <Col lg={5}>
          <div className={styles.widget}>
            <div className={styles.widgetHeader}>
              <h2 className={styles.widgetTitle}>Obras destacadas</h2>
              <Link href="/obras" className={styles.widgetLink}>
                Ver todas <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
            {destacadas.length === 0 ? (
              <div className={styles.empty}>No hay obras disponibles.</div>
            ) : (
              <ul className={styles.destacadasList}>
                {destacadas.map((o) => (
                  <li key={o.id} className={styles.destacadaItem}>
                    <img
                      src={o.imagen_url || PLACEHOLDER}
                      alt={o.titulo}
                      className={styles.destacadaThumb}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                    <div className={styles.destacadaMain}>
                      <div className={styles.ventaTitle}>{o.titulo}</div>
                      <div className={styles.ventaSub}>{o.autor}</div>
                    </div>
                    <div className={styles.ventaPrecio}>{formatPrecio(o.precio)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Col>
      </Row>

      <div className={styles.widget} style={{ height: 'auto' }}>
        <div className={styles.widgetHeader}>
          <h2 className={styles.widgetTitle}>Estado del sistema</h2>
        </div>
        <div className={styles.statusGrid}>
          <StatusDot ok={apiOnline} label="API" />
          <StatusDot ok={mqttOnline} label="Broker MQTT" />
          <StatusDot ok={espOnline} label="Microcontrolador" />
        </div>
      </div>
    </>
  );
}
