'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Table,
  Spinner,
  Alert,
  Row,
  Col,
  Modal,
  Form,
  InputGroup,
  Badge,
  Button,
} from 'react-bootstrap';
import styles from './page.module.css';
import { useObrasLive } from '@/hooks/useObrasLive';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><rect width="60" height="60" fill="%23e9ecef"/><text x="50%25" y="50%25" font-family="sans-serif" font-size="10" fill="%236c757d" text-anchor="middle" dominant-baseline="middle">N/A</text></svg>';

const SORT_OPTIONS = [
  { value: 'fecha_desc', label: 'Más recientes primero' },
  { value: 'fecha_asc', label: 'Más antiguas primero' },
  { value: 'precio_desc', label: 'Precio (mayor primero)' },
  { value: 'precio_asc', label: 'Precio (menor primero)' },
  { value: 'obra_asc', label: 'Obra (A-Z)' },
  { value: 'obra_desc', label: 'Obra (Z-A)' },
];

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
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function compareVentas(a, b, sortKey) {
  const [field, dir] = sortKey.split('_');
  const mult = dir === 'asc' ? 1 : -1;
  if (field === 'fecha') {
    return (new Date(a.fecha_venta).getTime() - new Date(b.fecha_venta).getTime()) * mult;
  }
  if (field === 'precio') {
    return (parseFloat(a.precio_venta) - parseFloat(b.precio_venta)) * mult;
  }
  if (field === 'obra') {
    return (
      String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es', {
        sensitivity: 'base',
      }) * mult
    );
  }
  return 0;
}

function HardwareBadge({ sincronizado }) {
  if (sincronizado) {
    return (
      <Badge bg="success" className={styles.badge}>
        <i className="bi bi-check-circle-fill me-1"></i>Sincronizado
      </Badge>
    );
  }
  return (
    <Badge bg="warning" text="dark" className={styles.badge}>
      <i className="bi bi-clock-fill me-1"></i>Pendiente
    </Badge>
  );
}

function KpiCard({ label, value }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
    </div>
  );
}

export default function VentasPage() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedVenta, setSelectedVenta] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('fecha_desc');
  const [feriaFilter, setFeriaFilter] = useState('all'); // 'all' | 'none' | feria_id

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_URL}/api/ventas`)
      .then((res) => {
        if (!cancelled) setVentas(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error cargando ventas');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sincronización en vivo: refetch al detectar una venta nueva por MQTT
  useObrasLive(() => {
    axios
      .get(`${API_URL}/api/ventas`)
      .then((res) => setVentas(res.data))
      .catch((err) => console.warn('[ventas] refetch falló:', err.message));
  });

  const feriasList = useMemo(() => {
    const map = new Map();
    ventas.forEach((v) => {
      if (v.feria_id != null && v.feria_nombre) {
        map.set(v.feria_id, v.feria_nombre);
      }
    });
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
      );
  }, [ventas]);

  const visibleVentas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = q
      ? ventas.filter(
          (v) =>
            v.titulo?.toLowerCase().includes(q) ||
            v.autor?.toLowerCase().includes(q) ||
            v.comprador_nombre?.toLowerCase().includes(q) ||
            v.comprador_email?.toLowerCase().includes(q)
        )
      : ventas;

    if (feriaFilter === 'none') {
      filtered = filtered.filter((v) => v.feria_id == null);
    } else if (feriaFilter !== 'all') {
      const id = parseInt(feriaFilter, 10);
      filtered = filtered.filter((v) => v.feria_id === id);
    }

    return [...filtered].sort((a, b) => compareVentas(a, b, sortKey));
  }, [ventas, searchQuery, sortKey, feriaFilter]);

  const kpis = useMemo(() => {
    const total = visibleVentas.length;
    const ingresos = visibleVentas.reduce(
      (sum, v) => sum + (parseFloat(v.precio_venta) || 0),
      0
    );
    const promedio = total > 0 ? ingresos / total : 0;
    return { total, ingresos, promedio };
  }, [visibleVentas]);

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
        <strong>No se pudieron cargar las ventas.</strong> {error}
      </Alert>
    );
  }

  return (
    <>
      <h1 className={styles.title}>Ventas</h1>

      <Row className="g-3 mb-4">
        <Col md={4}>
          <KpiCard label="Total ventas" value={kpis.total} />
        </Col>
        <Col md={4}>
          <KpiCard label="Ingresos totales" value={formatPrecio(kpis.ingresos)} />
        </Col>
        <Col md={4}>
          <KpiCard label="Precio medio" value={formatPrecio(kpis.promedio)} />
        </Col>
      </Row>

      <div className={styles.toolbar}>
        <InputGroup className={styles.search}>
          <InputGroup.Text>
            <i className="bi bi-search"></i>
          </InputGroup.Text>
          <Form.Control
            type="search"
            placeholder="Buscar por obra, autor o comprador…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="outline-secondary"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
            >
              <i className="bi bi-x-lg"></i>
            </Button>
          )}
        </InputGroup>

        <InputGroup className={styles.sort}>
          <InputGroup.Text>
            <i className="bi bi-arrow-down-up"></i>
          </InputGroup.Text>
          <Form.Select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            aria-label="Ordenar ventas"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Form.Select>
        </InputGroup>

        <InputGroup className={styles.feria}>
          <InputGroup.Text>
            <i className="bi bi-shop"></i>
          </InputGroup.Text>
          <Form.Select
            value={feriaFilter}
            onChange={(e) => setFeriaFilter(e.target.value)}
            aria-label="Filtrar por feria"
          >
            <option value="all">Todas las ferias</option>
            <option value="none">Sin feria asociada</option>
            {feriasList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </Form.Select>
        </InputGroup>
      </div>

      {ventas.length === 0 ? (
        <Alert variant="info">Aún no se han registrado ventas.</Alert>
      ) : visibleVentas.length === 0 ? (
        <Alert variant="info">
          No hay ventas que coincidan con &quot;{searchQuery}&quot;.
        </Alert>
      ) : (
        <div className={styles.tableWrapper}>
          <Table hover responsive className={styles.table}>
            <thead>
              <tr>
                <th aria-label="Imagen"></th>
                <th>Obra</th>
                <th>Comprador</th>
                <th className="text-end">Precio</th>
                <th>Fecha</th>
                <th>Hardware</th>
              </tr>
            </thead>
            <tbody>
              {visibleVentas.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => setSelectedVenta(v)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedVenta(v);
                    }
                  }}
                >
                  <td>
                    <img
                      src={v.imagen_url || PLACEHOLDER}
                      alt={v.titulo}
                      className={styles.thumb}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                  </td>
                  <td>
                    <div className={styles.primary}>{v.titulo}</div>
                    <div className={styles.muted}>{v.autor}</div>
                  </td>
                  <td>
                    <div className={styles.primary}>{v.comprador_nombre || '—'}</div>
                    <div className={styles.muted}>{v.comprador_email || '—'}</div>
                  </td>
                  <td className={`text-end ${styles.precioCell}`}>
                    {formatPrecio(v.precio_venta)}
                  </td>
                  <td className={styles.fechaCell}>{formatFecha(v.fecha_venta)}</td>
                  <td>
                    <HardwareBadge sincronizado={v.sincronizado_hardware} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Modal
        show={!!selectedVenta}
        onHide={() => setSelectedVenta(null)}
        size="lg"
        centered
        backdropClassName={styles.blurBackdrop}
      >
        {selectedVenta && (
          <>
            <Modal.Header closeButton>
              <Modal.Title className={styles.modalTitle}>
                Venta #{selectedVenta.id}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Row className="g-4">
                <Col md={5}>
                  <div className={styles.modalImageWrapper}>
                    <img
                      src={selectedVenta.imagen_url || PLACEHOLDER}
                      alt={selectedVenta.titulo}
                      className={styles.modalImage}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                  </div>
                </Col>
                <Col md={7}>
                  <div className={styles.modalDetails}>
                    <div className={styles.detailGroup}>
                      <div className={styles.groupTitle}>Obra</div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Título</span>
                        <span>{selectedVenta.titulo}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Autor</span>
                        <span>{selectedVenta.autor}</span>
                      </div>
                    </div>

                    <div className={styles.detailGroup}>
                      <div className={styles.groupTitle}>Comprador</div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Nombre</span>
                        <span>{selectedVenta.comprador_nombre || '—'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Email</span>
                        <span>{selectedVenta.comprador_email || '—'}</span>
                      </div>
                    </div>

                    <div className={styles.detailGroup}>
                      <div className={styles.groupTitle}>Transacción</div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Precio</span>
                        <span className={styles.modalPrecio}>
                          {formatPrecio(selectedVenta.precio_venta)}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Fecha</span>
                        <span>{formatFecha(selectedVenta.fecha_venta)}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Feria</span>
                        <span>{selectedVenta.feria_nombre || '—'}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Hardware</span>
                        <HardwareBadge
                          sincronizado={selectedVenta.sincronizado_hardware}
                        />
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
            </Modal.Body>
          </>
        )}
      </Modal>
    </>
  );
}
