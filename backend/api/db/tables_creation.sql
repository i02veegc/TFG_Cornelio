CREATE TABLE IF NOT EXISTS ferias (
	id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    ubicacion VARCHAR(255),
    fecha_inicio DATE,
    fecha_fin DATE,
    descripcion TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS obras (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    autor VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(14, 2) NOT NULL,
    anio INTEGER,
    dimensiones VARCHAR(100),
    imagen_url VARCHAR(500),
    vendido BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS obras_ferias (
    id SERIAL PRIMARY KEY,
    obra_id INTEGER REFERENCES obras(id) ON DELETE CASCADE,
    feria_id INTEGER REFERENCES ferias(id) ON DELETE CASCADE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(obra_id, feria_id)
);

CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    obra_id INTEGER REFERENCES obras(id),
    feria_id INTEGER REFERENCES ferias(id),
    comprador_nombre VARCHAR(255),
    comprador_email VARCHAR(255),
    precio_venta DECIMAL(14, 2),
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sincronizado_hardware BOOLEAN DEFAULT FALSE
);

ALTER TABLE obras ALTER COLUMN precio TYPE DECIMAL(14, 2);
ALTER TABLE ventas ALTER COLUMN precio_venta TYPE DECIMAL(14, 2);
