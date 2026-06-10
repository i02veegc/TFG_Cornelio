'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Card,
  Spinner,
  Alert,
  Row,
  Col,
  Modal,
  Button,
  Form,
  InputGroup,
} from 'react-bootstrap';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const SORT_OPTIONS = [
  { value: 'fecha_desc', label: 'Más recientes primero' },
  { value: 'fecha_asc', label: 'Más antiguas primero' },
  { value: 'nombre_asc', label: 'Nombre (A-Z)' },
  { value: 'nombre_desc', label: 'Nombre (Z-A)' },
];

const EMPTY_FORM = {
  nombre: '',
  ubicacion: '',
  fecha_inicio: '',
  fecha_fin: '',
  descripcion: '',
  obra_ids: [],
};

function compareFerias(a, b, sortKey) {
  const [field, dir] = sortKey.split('_');
  const mult = dir === 'asc' ? 1 : -1;
  if (field === 'fecha') {
    const va = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
    const vb = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
    return (va - vb) * mult;
  }
  if (field === 'nombre') {
    return (
      String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', {
        sensitivity: 'base',
      }) * mult
    );
  }
  return 0;
}

function getFeriaStatus(feria) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inicio = feria.fecha_inicio ? new Date(feria.fecha_inicio) : null;
  const fin = feria.fecha_fin ? new Date(feria.fecha_fin) : null;
  if (!inicio && !fin) return 'sin_fechas';
  if (inicio && today < inicio) return 'proxima';
  if (fin && today > fin) return 'finalizada';
  return 'en_curso';
}

function formatDateRange(inicio, fin) {
  const fmt = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (!inicio && !fin) return 'Sin fechas';
  if (inicio && fin) {
    return `${fmt.format(new Date(inicio))} – ${fmt.format(new Date(fin))}`;
  }
  if (inicio) return `Desde ${fmt.format(new Date(inicio))}`;
  return `Hasta ${fmt.format(new Date(fin))}`;
}

function toDateInput(value) {
  if (!value) return '';
  // El backend devuelve ISO timestamp; el input HTML necesita YYYY-MM-DD
  return new Date(value).toISOString().slice(0, 10);
}

function StatusPill({ status }) {
  const config = {
    en_curso: { label: 'En curso', className: styles.statusEnCurso },
    proxima: { label: 'Próxima', className: styles.statusProxima },
    finalizada: { label: 'Finalizada', className: styles.statusFinalizada },
    sin_fechas: { label: 'Sin fechas', className: styles.statusSinFechas },
  };
  const c = config[status] || config.sin_fechas;
  return (
    <span className={`${styles.status} ${c.className}`}>
      <span className={styles.statusDot} aria-hidden="true" />
      {c.label}
    </span>
  );
}

function ObrasMultiSelect({ obras, selectedIds, onToggle, disabled }) {
  if (obras.length === 0) {
    return (
      <div className={styles.obrasEmpty}>No hay obras todavía.</div>
    );
  }
  return (
    <div className={styles.obrasList}>
      {obras.map((o) => {
        const checked = selectedIds.includes(o.id);
        return (
          <label
            key={o.id}
            className={`${styles.obraRow} ${checked ? styles.obraRowChecked : ''}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(o.id)}
              disabled={disabled}
            />
            <span className={styles.obraRowTitle}>{o.titulo}</span>
            <span className={styles.obraRowAutor}>{o.autor}</span>
          </label>
        );
      })}
    </div>
  );
}

function extractApiError(err, fallback) {
  const data = err.response?.data;
  if (data?.detail && data?.error) return `${data.error}: ${data.detail}`;
  return data?.error || err.message || fallback;
}

export default function FeriasPage() {
  const [ferias, setFerias] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedFeria, setSelectedFeria] = useState(null);
  const [mode, setMode] = useState('detail'); // 'detail' | 'edit'

  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('fecha_desc');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${API_URL}/api/ferias`),
      axios.get(`${API_URL}/api/obras`),
    ])
      .then(([resFerias, resObras]) => {
        if (cancelled) return;
        setFerias(resFerias.data);
        setObras(resObras.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error cargando datos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleFerias = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? ferias.filter(
          (f) =>
            f.nombre?.toLowerCase().includes(q) ||
            f.ubicacion?.toLowerCase().includes(q)
        )
      : ferias;
    return [...filtered].sort((a, b) => compareFerias(a, b, sortKey));
  }, [ferias, searchQuery, sortKey]);

  const openDetail = (feria) => {
    setSelectedFeria(feria);
    setMode('detail');
    setEditError(null);
    setConfirmDelete(false);
  };

  const closeDetail = () => {
    setSelectedFeria(null);
    setMode('detail');
    setConfirmDelete(false);
  };

  const openEditForm = () => {
    setEditForm({
      nombre: selectedFeria.nombre ?? '',
      ubicacion: selectedFeria.ubicacion ?? '',
      fecha_inicio: toDateInput(selectedFeria.fecha_inicio),
      fecha_fin: toDateInput(selectedFeria.fecha_fin),
      descripcion: selectedFeria.descripcion ?? '',
      obra_ids: Array.isArray(selectedFeria.obra_ids) ? [...selectedFeria.obra_ids] : [],
    });
    setEditError(null);
    setConfirmDelete(false);
    setMode('edit');
  };

  const toggleObraInForm = (formSetter, obraId) => {
    formSetter((p) => {
      const current = p.obra_ids || [];
      const next = current.includes(obraId)
        ? current.filter((id) => id !== obraId)
        : [...current, obraId];
      return { ...p, obra_ids: next };
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSubmittingEdit(true);
    setEditError(null);
    try {
      const payload = {
        nombre: editForm.nombre.trim() || null,
        ubicacion: editForm.ubicacion.trim() || null,
        fecha_inicio: editForm.fecha_inicio || null,
        fecha_fin: editForm.fecha_fin || null,
        descripcion: editForm.descripcion.trim() || null,
        obra_ids: editForm.obra_ids,
      };
      const res = await axios.put(
        `${API_URL}/api/ferias/${selectedFeria.id}`,
        payload
      );
      const updated = {
        ...res.data,
        total_obras: res.data.obra_ids?.length ?? 0,
        total_ventas: selectedFeria.total_ventas,
      };
      setFerias((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setSelectedFeria(updated);
      setMode('detail');
    } catch (err) {
      setEditError(extractApiError(err, 'Error actualizando feria'));
    } finally {
      setSubmittingEdit(false);
    }
  };

  const submitDelete = async () => {
    setDeleting(true);
    setEditError(null);
    try {
      await axios.delete(`${API_URL}/api/ferias/${selectedFeria.id}`);
      setFerias((prev) => prev.filter((f) => f.id !== selectedFeria.id));
      closeDetail();
    } catch (err) {
      setEditError(extractApiError(err, 'Error eliminando feria'));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const openCreateModal = () => {
    setCreateForm(EMPTY_FORM);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setSubmittingCreate(true);
    setCreateError(null);
    try {
      const payload = {
        nombre: createForm.nombre.trim() || null,
        ubicacion: createForm.ubicacion.trim() || null,
        fecha_inicio: createForm.fecha_inicio || null,
        fecha_fin: createForm.fecha_fin || null,
        descripcion: createForm.descripcion.trim() || null,
        obra_ids: createForm.obra_ids,
      };
      const res = await axios.post(`${API_URL}/api/ferias`, payload);
      const created = {
        ...res.data,
        total_obras: res.data.obra_ids?.length ?? 0,
        total_ventas: 0,
      };
      setFerias((prev) => [created, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      setCreateError(extractApiError(err, 'Error creando feria'));
    } finally {
      setSubmittingCreate(false);
    }
  };

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
        <strong>No se pudieron cargar las ferias.</strong> {error}
      </Alert>
    );
  }

  const busy = submittingEdit || deleting;

  return (
    <>
      <h1 className={styles.title}>Ferias</h1>

      <div className={styles.toolbar}>
        <InputGroup className={styles.search}>
          <InputGroup.Text>
            <i className="bi bi-search"></i>
          </InputGroup.Text>
          <Form.Control
            type="search"
            placeholder="Buscar por nombre o ubicación…"
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
            aria-label="Ordenar ferias"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Form.Select>
        </InputGroup>
      </div>

      <div className={styles.resultsBar}>
        <span className={styles.results}>
          Mostrando {visibleFerias.length} resultados
        </span>
        <Button variant="primary" onClick={openCreateModal}>
          <i className="bi bi-plus-lg me-2"></i>Añadir feria
        </Button>
      </div>

      {ferias.length === 0 ? (
        <Alert variant="info">Aún no hay ferias registradas.</Alert>
      ) : visibleFerias.length === 0 ? (
        <Alert variant="info">
          No hay ferias que coincidan con &quot;{searchQuery}&quot;.
        </Alert>
      ) : (
        <Row xs={1} sm={2} lg={3} className="g-4">
          {visibleFerias.map((feria) => {
            const status = getFeriaStatus(feria);
            return (
              <Col key={feria.id}>
                <Card
                  className={styles.card}
                  onClick={() => openDetail(feria)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDetail(feria);
                    }
                  }}
                >
                  <Card.Body>
                    <div className={styles.cardHeader}>
                      <Card.Title className={styles.cardTitle}>
                        {feria.nombre}
                      </Card.Title>
                      <StatusPill status={status} />
                    </div>
                    {feria.ubicacion && (
                      <div className={styles.meta}>
                        <i className="bi bi-geo-alt me-2"></i>
                        {feria.ubicacion}
                      </div>
                    )}
                    <div className={styles.meta}>
                      <i className="bi bi-calendar-range me-2"></i>
                      {formatDateRange(feria.fecha_inicio, feria.fecha_fin)}
                    </div>
                    {feria.descripcion && (
                      <Card.Text className={styles.description}>
                        {feria.descripcion}
                      </Card.Text>
                    )}
                  </Card.Body>
                  <Card.Footer className={styles.footer}>
                    <span>
                      <strong>{feria.total_obras}</strong> obras
                    </span>
                    <span className={styles.dot}>·</span>
                    <span>
                      <strong>{feria.total_ventas}</strong> ventas
                    </span>
                  </Card.Footer>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Modal de detalle / edición */}
      <Modal
        show={!!selectedFeria}
        onHide={busy ? undefined : closeDetail}
        size="lg"
        centered
        backdropClassName={styles.blurBackdrop}
      >
        {selectedFeria && (
          <>
            <Modal.Header closeButton={!busy}>
              <Modal.Title className={styles.modalTitle}>
                {mode === 'edit' ? `Editar: ${selectedFeria.nombre}` : selectedFeria.nombre}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {mode === 'edit' ? (
                <Form id="editFeriaForm" onSubmit={submitEdit} className={styles.editForm}>
                  <Form.Group>
                    <Form.Label className={styles.detailLabel}>Nombre</Form.Label>
                    <Form.Control
                      type="text"
                      required
                      value={editForm.nombre}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, nombre: e.target.value }))
                      }
                      disabled={busy}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label className={styles.detailLabel}>Ubicación</Form.Label>
                    <Form.Control
                      type="text"
                      value={editForm.ubicacion}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, ubicacion: e.target.value }))
                      }
                      disabled={busy}
                    />
                  </Form.Group>
                  <Row className="g-2">
                    <Col xs={6}>
                      <Form.Group>
                        <Form.Label className={styles.detailLabel}>Fecha inicio</Form.Label>
                        <Form.Control
                          type="date"
                          value={editForm.fecha_inicio}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, fecha_inicio: e.target.value }))
                          }
                          disabled={busy}
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={6}>
                      <Form.Group>
                        <Form.Label className={styles.detailLabel}>Fecha fin</Form.Label>
                        <Form.Control
                          type="date"
                          value={editForm.fecha_fin}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, fecha_fin: e.target.value }))
                          }
                          disabled={busy}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Form.Group>
                    <Form.Label className={styles.detailLabel}>Descripción</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={editForm.descripcion}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, descripcion: e.target.value }))
                      }
                      disabled={busy}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label className={styles.detailLabel}>
                      Obras vinculadas ({editForm.obra_ids.length})
                    </Form.Label>
                    <ObrasMultiSelect
                      obras={obras}
                      selectedIds={editForm.obra_ids}
                      onToggle={(id) => toggleObraInForm(setEditForm, id)}
                      disabled={busy}
                    />
                  </Form.Group>
                </Form>
              ) : (
                <div className={styles.modalDetails}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Estado</span>
                    <StatusPill status={getFeriaStatus(selectedFeria)} />
                  </div>
                  {selectedFeria.ubicacion && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Ubicación</span>
                      <span>{selectedFeria.ubicacion}</span>
                    </div>
                  )}
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Fechas</span>
                    <span>
                      {formatDateRange(
                        selectedFeria.fecha_inicio,
                        selectedFeria.fecha_fin
                      )}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Obras</span>
                    <span>{selectedFeria.total_obras ?? 0}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Ventas</span>
                    <span>{selectedFeria.total_ventas ?? 0}</span>
                  </div>
                  {selectedFeria.descripcion && (
                    <div className={styles.detailDescription}>
                      <span className={styles.detailLabel}>Descripción</span>
                      <p>{selectedFeria.descripcion}</p>
                    </div>
                  )}
                </div>
              )}
              {mode === 'edit' && editError && (
                <Alert variant="danger" className="mt-3 mb-0 py-2">
                  {editError}
                </Alert>
              )}
            </Modal.Body>
            <Modal.Footer className={styles.modalFooter}>
              {mode === 'detail' && (
                <Button variant="outline-primary" onClick={openEditForm}>
                  <i className="bi bi-pencil me-2"></i>Editar
                </Button>
              )}

              {mode === 'edit' && !confirmDelete && (
                <div className={styles.editFooter}>
                  <Button
                    variant="outline-danger"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    <i className="bi bi-trash me-2"></i>Eliminar
                  </Button>
                  <div className={styles.editFooterRight}>
                    <Button
                      variant="outline-secondary"
                      onClick={() => setMode('detail')}
                      disabled={busy}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      form="editFeriaForm"
                      variant="primary"
                      disabled={busy}
                    >
                      {submittingEdit ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Guardando…
                        </>
                      ) : (
                        'Guardar cambios'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {mode === 'edit' && confirmDelete && (
                <div className={styles.confirmDelete}>
                  <span className={styles.confirmDeleteText}>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    ¿Eliminar &quot;{selectedFeria.nombre}&quot;? Esta acción no se puede deshacer.
                  </span>
                  <div className={styles.editFooterRight}>
                    <Button
                      variant="outline-secondary"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Cancelar
                    </Button>
                    <Button variant="danger" onClick={submitDelete} disabled={deleting}>
                      {deleting ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Eliminando…
                        </>
                      ) : (
                        'Sí, eliminar'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* Modal de creación */}
      <Modal
        show={showCreateModal}
        onHide={submittingCreate ? undefined : () => setShowCreateModal(false)}
        size="lg"
        centered
        backdropClassName={styles.blurBackdrop}
      >
        <Modal.Header closeButton={!submittingCreate}>
          <Modal.Title className={styles.modalTitle}>Nueva feria</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form id="createFeriaForm" onSubmit={submitCreate} className={styles.editForm}>
            <Form.Group>
              <Form.Label className={styles.detailLabel}>Nombre</Form.Label>
              <Form.Control
                type="text"
                required
                value={createForm.nombre}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, nombre: e.target.value }))
                }
                disabled={submittingCreate}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label className={styles.detailLabel}>Ubicación</Form.Label>
              <Form.Control
                type="text"
                value={createForm.ubicacion}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, ubicacion: e.target.value }))
                }
                disabled={submittingCreate}
              />
            </Form.Group>
            <Row className="g-2">
              <Col xs={6}>
                <Form.Group>
                  <Form.Label className={styles.detailLabel}>Fecha inicio</Form.Label>
                  <Form.Control
                    type="date"
                    value={createForm.fecha_inicio}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, fecha_inicio: e.target.value }))
                    }
                    disabled={submittingCreate}
                  />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group>
                  <Form.Label className={styles.detailLabel}>Fecha fin</Form.Label>
                  <Form.Control
                    type="date"
                    value={createForm.fecha_fin}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, fecha_fin: e.target.value }))
                    }
                    disabled={submittingCreate}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group>
              <Form.Label className={styles.detailLabel}>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={createForm.descripcion}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, descripcion: e.target.value }))
                }
                disabled={submittingCreate}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label className={styles.detailLabel}>
                Obras vinculadas ({createForm.obra_ids.length})
              </Form.Label>
              <ObrasMultiSelect
                obras={obras}
                selectedIds={createForm.obra_ids}
                onToggle={(id) => toggleObraInForm(setCreateForm, id)}
                disabled={submittingCreate}
              />
            </Form.Group>
          </Form>
          {createError && (
            <Alert variant="danger" className="mt-3 mb-0 py-2">
              {createError}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setShowCreateModal(false)}
            disabled={submittingCreate}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="createFeriaForm"
            variant="primary"
            disabled={submittingCreate}
          >
            {submittingCreate ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Creando…
              </>
            ) : (
              'Crear feria'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
