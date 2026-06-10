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
import { useObrasLive } from '@/hooks/useObrasLive';

const SORT_OPTIONS = [
  { value: 'default', label: 'Por defecto' },
  { value: 'titulo_asc', label: 'Título (A-Z)' },
  { value: 'titulo_desc', label: 'Título (Z-A)' },
  { value: 'autor_asc', label: 'Autor (A-Z)' },
  { value: 'autor_desc', label: 'Autor (Z-A)' },
  { value: 'anio_asc', label: 'Año (más antiguo)' },
  { value: 'anio_desc', label: 'Año (más reciente)' },
  { value: 'precio_asc', label: 'Precio (menor primero)' },
  { value: 'precio_desc', label: 'Precio (mayor primero)' },
];

function compareObras(a, b, sortKey) {
  if (sortKey === 'default') return 0;
  const [field, dir] = sortKey.split('_');
  const mult = dir === 'asc' ? 1 : -1;
  const va = a[field];
  const vb = b[field];
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (field === 'precio' || field === 'anio') {
    return (parseFloat(va) - parseFloat(vb)) * mult;
  }
  return String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' }) * mult;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23e9ecef"/><text x="50%25" y="50%25" font-family="sans-serif" font-size="18" fill="%236c757d" text-anchor="middle" dominant-baseline="middle">Sin imagen</text></svg>';

const EMPTY_EDIT_FORM = {
  titulo: '',
  autor: '',
  descripcion: '',
  precio: '',
  anio: '',
  dimensiones: '',
  imagen_url: '',
};

function ImageDropZone({ onUpload, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    setFilename(file.name);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const res = await axios.post(`${API_URL}/api/obras/upload`, fd);
      onUpload(res.data.url);
    } catch {
      setFilename(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`${styles.dropZone} ${dragging ? styles.dropZoneActive : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => !disabled && !uploading && document.getElementById('imageFileInput').click()}
    >
      <input
        id="imageFileInput"
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
        disabled={disabled || uploading}
      />
      {uploading ? (
        <>
          <Spinner size="sm" animation="border" className="me-2" />
          Subiendo…
        </>
      ) : (
        <>
          <i className={`bi bi-cloud-arrow-up ${styles.dropZoneIcon}`} />
          Arrastra una imagen o haz clic para seleccionar
          {filename && <div className={styles.dropZoneFilename}>{filename}</div>}
        </>
      )}
    </div>
  );
}

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

function StatusPill({ vendido }) {
  return (
    <span
      className={`${styles.status} ${
        vendido ? styles.statusSold : styles.statusAvailable
      }`}
    >
      <span className={styles.statusDot} aria-hidden="true" />
      {vendido ? 'Vendido' : 'Disponible'}
    </span>
  );
}

function extractApiError(err, fallback) {
  const data = err.response?.data;
  if (data?.detail && data?.error) return `${data.error}: ${data.detail}`;
  return data?.error || err.message || fallback;
}

const EMPTY_SALE_FORM = {
  comprador_nombre: '',
  comprador_email: '',
  feria_id: '',
};

export default function ObrasPage() {
  const [obras, setObras] = useState([]);
  const [ferias, setFerias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedObra, setSelectedObra] = useState(null);
  const [mode, setMode] = useState('detail'); // 'detail' | 'sale' | 'edit'

  const [saleForm, setSaleForm] = useState(EMPTY_SALE_FORM);
  const [saleError, setSaleError] = useState(null);
  const [submittingSale, setSubmittingSale] = useState(false);

  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editError, setEditError] = useState(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('default');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_EDIT_FORM);
  const [createError, setCreateError] = useState(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const visibleObras = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? obras.filter(
          (o) =>
            o.titulo?.toLowerCase().includes(q) ||
            o.autor?.toLowerCase().includes(q)
        )
      : obras;
    if (sortKey === 'default') return filtered;
    return [...filtered].sort((a, b) => compareObras(a, b, sortKey));
  }, [obras, searchQuery, sortKey]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get(`${API_URL}/api/obras`),
      axios.get(`${API_URL}/api/ferias`).catch(() => ({ data: [] })),
    ])
      .then(([resObras, resFerias]) => {
        if (cancelled) return;
        setObras(resObras.data);
        setFerias(resFerias.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Error cargando obras');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sincronización en vivo vía MQTT: cuando alguien vende una obra desde
  // Unity o desde otra pestaña, actualizar la card sin recargar.
  useObrasLive((obraId) => {
    setObras((prev) =>
      prev.map((o) => (o.id === obraId ? { ...o, vendido: true } : o))
    );
  });

  const openDetail = (obra) => {
    setSelectedObra(obra);
    setMode('detail');
    setSaleForm(EMPTY_SALE_FORM);
    setSaleError(null);
    setEditError(null);
    setConfirmDelete(false);
  };

  const closeDetail = () => {
    setSelectedObra(null);
    setMode('detail');
    setConfirmDelete(false);
  };

  const openSaleForm = () => {
    setMode('sale');
    setSaleForm(EMPTY_SALE_FORM);
    setSaleError(null);
  };

  const openEditForm = () => {
    setEditForm({
      titulo: selectedObra.titulo ?? '',
      autor: selectedObra.autor ?? '',
      descripcion: selectedObra.descripcion ?? '',
      precio: selectedObra.precio ?? '',
      anio: selectedObra.anio ?? '',
      dimensiones: selectedObra.dimensiones ?? '',
      imagen_url: selectedObra.imagen_url ?? '',
    });
    setEditError(null);
    setConfirmDelete(false);
    setMode('edit');
  };

  const submitSale = async (e) => {
    e.preventDefault();
    setSubmittingSale(true);
    setSaleError(null);
    try {
      await axios.post(`${API_URL}/api/ventas`, {
        obra_id: selectedObra.id,
        comprador_nombre: saleForm.comprador_nombre,
        comprador_email: saleForm.comprador_email,
        feria_id: saleForm.feria_id ? parseInt(saleForm.feria_id, 10) : null,
      });
      setObras((prev) =>
        prev.map((o) => (o.id === selectedObra.id ? { ...o, vendido: true } : o))
      );
      closeDetail();
    } catch (err) {
      setSaleError(extractApiError(err, 'Error registrando venta'));
    } finally {
      setSubmittingSale(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSubmittingEdit(true);
    setEditError(null);
    try {
      const payload = {
        titulo: editForm.titulo.trim() || null,
        autor: editForm.autor.trim() || null,
        descripcion: editForm.descripcion.trim() || null,
        precio: editForm.precio !== '' ? parseFloat(editForm.precio) : null,
        anio: editForm.anio !== '' ? parseInt(editForm.anio, 10) : null,
        dimensiones: editForm.dimensiones.trim() || null,
        imagen_url: editForm.imagen_url.trim() || null,
      };
      const res = await axios.put(`${API_URL}/api/obras/${selectedObra.id}`, payload);
      const updated = { ...res.data, ferias: selectedObra.ferias ?? [] };
      setObras((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSelectedObra(updated);
      setMode('detail');
    } catch (err) {
      setEditError(extractApiError(err, 'Error actualizando obra'));
    } finally {
      setSubmittingEdit(false);
    }
  };

  const openCreateModal = () => {
    setCreateForm(EMPTY_EDIT_FORM);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setSubmittingCreate(true);
    setCreateError(null);
    try {
      const payload = {
        titulo: createForm.titulo.trim() || null,
        autor: createForm.autor.trim() || null,
        descripcion: createForm.descripcion.trim() || null,
        precio: createForm.precio !== '' ? parseFloat(createForm.precio) : null,
        anio: createForm.anio !== '' ? parseInt(createForm.anio, 10) : null,
        dimensiones: createForm.dimensiones.trim() || null,
        imagen_url: createForm.imagen_url.trim() || null,
      };
      const res = await axios.post(`${API_URL}/api/obras`, payload);
      const created = { ...res.data, ferias: [] };
      setObras((prev) => [created, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      setCreateError(extractApiError(err, 'Error creando obra'));
    } finally {
      setSubmittingCreate(false);
    }
  };

  const submitDelete = async () => {
    setDeleting(true);
    setEditError(null);
    try {
      await axios.delete(`${API_URL}/api/obras/${selectedObra.id}`);
      setObras((prev) => prev.filter((o) => o.id !== selectedObra.id));
      closeDetail();
    } catch (err) {
      setEditError(extractApiError(err, 'Error eliminando obra'));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
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
        <strong>No se pudieron cargar las obras.</strong> {error}
      </Alert>
    );
  }

  if (obras.length === 0) {
    return <Alert variant="info">Aún no hay obras registradas.</Alert>;
  }

  const busy = submittingEdit || deleting;

  return (
    <>
      <h1 className={styles.title}>Obras</h1>

      <div className={styles.toolbar}>
        <Col>
          <InputGroup className={styles.search}>
            <InputGroup.Text>
              <i className="bi bi-search"></i>
            </InputGroup.Text>
            <Form.Control
              type="search"
              placeholder="Buscar por título o autor…"
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
        </Col>
        <Col>
          <InputGroup className={styles.sort}>
            <InputGroup.Text>
              <i className="bi bi-arrow-down-up"></i>
            </InputGroup.Text>
            <Form.Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              aria-label="Ordenar obras"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Form.Select>
          </InputGroup>
        </Col>
      </div>

      <div className={styles.resultsBar}>
        <span className={styles.results}>
          Mostrando {visibleObras.length} resultados
        </span>
        <Button variant="primary" onClick={openCreateModal}>
          <i className="bi bi-plus-lg me-2"></i>Añadir obra
        </Button>
      </div>

      {visibleObras.length === 0 ? (
        <Alert variant="info">
          No hay obras que coincidan con &quot;{searchQuery}&quot;.
        </Alert>
      ) : (
        <Row xs={1} sm={2} lg={3} xl={4} className="g-4">
          {visibleObras.map((obra) => (
          <Col key={obra.id}>
            <Card
              className={styles.card}
              onClick={() => openDetail(obra)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openDetail(obra);
                }
              }}
            >
              <div className={styles.imageWrapper}>
                <Card.Img
                  variant="top"
                  src={obra.imagen_url || PLACEHOLDER}
                  alt={obra.titulo}
                  className={styles.image}
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER;
                  }}
                />
              </div>
              <Card.Body>
                <Card.Title className={styles.cardTitle}>{obra.titulo}</Card.Title>
                <Card.Subtitle className="mb-2 text-muted">
                  {obra.autor}
                  {obra.anio ? ` · ${obra.anio}` : ''}
                </Card.Subtitle>
                {obra.descripcion && (
                  <Card.Text className={styles.description}>{obra.descripcion}</Card.Text>
                )}
                {obra.dimensiones && (
                  <div className={styles.meta}>
                    <i className="bi bi-rulers"></i> {obra.dimensiones}
                  </div>
                )}
              </Card.Body>
              <Card.Footer className={styles.footer}>
                <StatusPill vendido={obra.vendido} />
                <span className={styles.price}>{formatPrecio(obra.precio)}</span>
              </Card.Footer>
            </Card>
          </Col>
          ))}
        </Row>
      )}

      <Modal
        show={!!selectedObra}
        onHide={busy ? undefined : closeDetail}
        size="lg"
        centered
        backdropClassName={styles.blurBackdrop}
      >
        {selectedObra && (
          <>
            <Modal.Header closeButton={!busy}>
              <Modal.Title className={styles.modalTitle}>
                {mode === 'edit' ? `Editar: ${selectedObra.titulo}` : selectedObra.titulo}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Row className="g-4">
                <Col md={6}>
                  <div className={styles.modalImageWrapper}>
                    <img
                      src={
                        (mode === 'edit' ? editForm.imagen_url : selectedObra.imagen_url) ||
                        PLACEHOLDER
                      }
                      alt={selectedObra.titulo}
                      className={styles.modalImage}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                  </div>
                </Col>
                <Col md={6}>
                  {mode === 'edit' ? (
                    <Form id="editObraForm" onSubmit={submitEdit} className={styles.editForm}>
                      <Row className="g-2">
                        <Col xs={6}>
                          <Form.Group>
                            <Form.Label className={styles.detailLabel}>Título</Form.Label>
                            <Form.Control
                              type="text"
                              required
                              value={editForm.titulo}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, titulo: e.target.value }))
                              }
                              disabled={busy}
                            />
                          </Form.Group>
                        </Col>
                        <Col xs={6}>
                          <Form.Group>
                            <Form.Label className={styles.detailLabel}>Autor</Form.Label>
                            <Form.Control
                              type="text"
                              required
                              value={editForm.autor}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, autor: e.target.value }))
                              }
                              disabled={busy}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row className="g-2">
                        <Col xs={4}>
                          <Form.Group>
                            <Form.Label className={styles.detailLabel}>Dimensiones</Form.Label>
                            <Form.Control
                              type="text"
                              placeholder="Ej: 73 x 92 cm"
                              value={editForm.dimensiones}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, dimensiones: e.target.value }))
                              }
                              disabled={busy}
                            />
                          </Form.Group>
                        </Col>
                        <Col xs={4}>
                          <Form.Group>
                            <Form.Label className={styles.detailLabel}>Año</Form.Label>
                            <Form.Control
                              type="number"
                              value={editForm.anio}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, anio: e.target.value }))
                              }
                              disabled={busy}
                            />
                          </Form.Group>
                        </Col>
                        <Col xs={4}>
                          <Form.Group>
                            <Form.Label className={styles.detailLabel}>Precio (€)</Form.Label>
                            <Form.Control
                              type="number"
                              step="0.01"
                              required
                              value={editForm.precio}
                              onChange={(e) =>
                                setEditForm((p) => ({ ...p, precio: e.target.value }))
                              }
                              disabled={busy}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Form.Group>
                        <Form.Label className={styles.detailLabel}>URL de imagen</Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="http://localhost:3000/static/obras/..."
                          value={editForm.imagen_url}
                          onChange={(e) =>
                            setEditForm((p) => ({ ...p, imagen_url: e.target.value }))
                          }
                          disabled={busy}
                        />
                      </Form.Group>
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
                    </Form>
                  ) : (
                    <div className={styles.modalDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Autor</span>
                        <span>{selectedObra.autor}</span>
                      </div>
                      {selectedObra.anio && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Año</span>
                          <span>{selectedObra.anio}</span>
                        </div>
                      )}
                      {selectedObra.dimensiones && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Dimensiones</span>
                          <span>{selectedObra.dimensiones}</span>
                        </div>
                      )}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Precio</span>
                        <span className={styles.modalPrice}>
                          {formatPrecio(selectedObra.precio)}
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Estado</span>
                        <StatusPill vendido={selectedObra.vendido} />
                      </div>
                      {selectedObra.ferias && selectedObra.ferias.length > 0 && (
                        <div className={styles.detailFerias}>
                          <span className={styles.detailLabel}>Ferias</span>
                          <div className={styles.feriasPills}>
                            {selectedObra.ferias.map((f) => (
                              <span key={f.id} className={styles.feriaPill}>
                                <i className="bi bi-shop me-1"></i>
                                {f.nombre}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedObra.descripcion && (
                        <div className={styles.detailDescription}>
                          <span className={styles.detailLabel}>Descripción</span>
                          <p>{selectedObra.descripcion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </Col>
              </Row>
              {mode === 'edit' && editError && (
                <Alert variant="danger" className="mt-3 mb-0 py-2">
                  {editError}
                </Alert>
              )}
            </Modal.Body>
            <Modal.Footer className={styles.modalFooter}>
              {mode === 'detail' && (
                <>
                  <Button variant="outline-primary" onClick={openEditForm}>
                    <i className="bi bi-pencil me-2"></i>Editar
                  </Button>
                  <Button
                    variant="success"
                    onClick={openSaleForm}
                    disabled={selectedObra.vendido}
                  >
                    <i className="bi bi-cash-coin me-2"></i>
                    {selectedObra.vendido ? 'Ya vendida' : 'Marcar como vendida'}
                  </Button>
                </>
              )}

              {mode === 'sale' && (
                <Form onSubmit={submitSale} className={styles.saleForm}>
                  {saleError && (
                    <Alert variant="danger" className="mb-3 py-2">
                      {saleError}
                    </Alert>
                  )}
                  <Row className="g-2">
                    <Col sm={6}>
                      <Form.Group>
                        <Form.Label className={styles.detailLabel}>
                          Nombre del comprador
                        </Form.Label>
                        <Form.Control
                          type="text"
                          required
                          value={saleForm.comprador_nombre}
                          onChange={(e) =>
                            setSaleForm((prev) => ({
                              ...prev,
                              comprador_nombre: e.target.value,
                            }))
                          }
                          disabled={submittingSale}
                        />
                      </Form.Group>
                    </Col>
                    <Col sm={6}>
                      <Form.Group>
                        <Form.Label className={styles.detailLabel}>Email</Form.Label>
                        <Form.Control
                          type="email"
                          required
                          value={saleForm.comprador_email}
                          onChange={(e) =>
                            setSaleForm((prev) => ({
                              ...prev,
                              comprador_email: e.target.value,
                            }))
                          }
                          disabled={submittingSale}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Form.Group className="mt-2">
                    <Form.Label className={styles.detailLabel}>
                      Feria <span className={styles.optional}>(opcional)</span>
                    </Form.Label>
                    <Form.Select
                      value={saleForm.feria_id}
                      onChange={(e) =>
                        setSaleForm((prev) => ({
                          ...prev,
                          feria_id: e.target.value,
                        }))
                      }
                      disabled={submittingSale}
                    >
                      <option value="">Sin feria asociada</option>
                      {ferias.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nombre}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <div className={styles.saleFormActions}>
                    <Button
                      variant="outline-secondary"
                      onClick={() => setMode('detail')}
                      disabled={submittingSale}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" variant="success" disabled={submittingSale}>
                      {submittingSale ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Registrando…
                        </>
                      ) : (
                        'Confirmar venta'
                      )}
                    </Button>
                  </div>
                </Form>
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
                      form="editObraForm"
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
                    ¿Eliminar &quot;{selectedObra.titulo}&quot;? Esta acción no se puede deshacer.
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

      <Modal
        show={showCreateModal}
        onHide={submittingCreate ? undefined : () => setShowCreateModal(false)}
        size="lg"
        centered
        backdropClassName={styles.blurBackdrop}
      >
        <Modal.Header closeButton={!submittingCreate}>
          <Modal.Title className={styles.modalTitle}>Nueva obra</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-4">
            <Col md={6}>
              <div className={styles.modalImageWrapper}>
                <img
                  src={createForm.imagen_url || PLACEHOLDER}
                  alt="Vista previa"
                  className={styles.modalImage}
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER;
                  }}
                />
              </div>
            </Col>
            <Col md={6}>
              <Form id="createObraForm" onSubmit={submitCreate} className={styles.editForm}>
                <Row className="g-2">
                  <Col xs={6}>
                    <Form.Group>
                      <Form.Label className={styles.detailLabel}>Título</Form.Label>
                      <Form.Control
                        type="text"
                        required
                        value={createForm.titulo}
                        onChange={(e) =>
                          setCreateForm((p) => ({ ...p, titulo: e.target.value }))
                        }
                        disabled={submittingCreate}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={6}>
                    <Form.Group>
                      <Form.Label className={styles.detailLabel}>Autor</Form.Label>
                      <Form.Control
                        type="text"
                        required
                        value={createForm.autor}
                        onChange={(e) =>
                          setCreateForm((p) => ({ ...p, autor: e.target.value }))
                        }
                        disabled={submittingCreate}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="g-2">
                  <Col xs={3}>
                    <Form.Group>
                      <Form.Label className={styles.detailLabel}>Año</Form.Label>
                      <Form.Control
                        type="number"
                        value={createForm.anio}
                        onChange={(e) =>
                          setCreateForm((p) => ({ ...p, anio: e.target.value }))
                        }
                        disabled={submittingCreate}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={4}>
                    <Form.Group>
                      <Form.Label className={styles.detailLabel}>Precio (€)</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        required
                        value={createForm.precio}
                        onChange={(e) =>
                          setCreateForm((p) => ({ ...p, precio: e.target.value }))
                        }
                        disabled={submittingCreate}
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={5}>
                    <Form.Group>
                      <Form.Label className={styles.detailLabel}>Dimensiones</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Ej: 73 x 92 cm"
                        value={createForm.dimensiones}
                        onChange={(e) =>
                          setCreateForm((p) => ({ ...p, dimensiones: e.target.value }))
                        }
                        disabled={submittingCreate}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group>
                  <Form.Label className={styles.detailLabel}>Imagen</Form.Label>
                  <ImageDropZone
                    onUpload={(url) => setCreateForm((p) => ({ ...p, imagen_url: url }))}
                    disabled={submittingCreate}
                  />
                </Form.Group>
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
              </Form>
            </Col>
          </Row>
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
            form="createObraForm"
            variant="primary"
            disabled={submittingCreate}
          >
            {submittingCreate ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Creando…
              </>
            ) : (
              'Crear obra'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
