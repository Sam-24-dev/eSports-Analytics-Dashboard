--   SISTEMA DE CULTIVO DE ARROZ
DROP DATABASE IF EXISTS Cultivo_Arroz;
CREATE DATABASE Cultivo_Arroz;
USE Cultivo_Arroz;
-- Primero eliminar usuarios si existen 
DROP USER IF EXISTS 'jefe_cultivo'@'localhost';
DROP USER IF EXISTS 'supervisor'@'localhost';
DROP USER IF EXISTS 'trabajador'@'localhost';
DROP USER IF EXISTS 'consulta'@'localhost';

CREATE TABLE persona(
    cedula CHAR(10) PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL,
    telefono CHAR(10) NOT NULL,
    email VARCHAR(50) UNIQUE,
    fecha_contrato DATE NOT NULL,
    salario_diario DECIMAL(8,2) DEFAULT 15.00 CHECK (salario_diario > 0),
    especialidad ENUM('General', 'Sembrado', 'Riego', 'Cosecha', 'Aplicacion', 'Supervisor') DEFAULT 'General',
    estado ENUM('Activo', 'Inactivo', 'Vacaciones') DEFAULT 'Activo',
    jefe CHAR(10),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_jefe FOREIGN KEY (jefe) REFERENCES persona(cedula) ON DELETE SET NULL,
    CONSTRAINT chk_email CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE TABLE area(
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE,
    hectareas DECIMAL(6,2) NOT NULL CHECK (hectareas > 0),
    tipo_suelo ENUM('Arcilloso', 'Franco', 'Limoso', 'Arenoso') DEFAULT 'Arcilloso',
    estado ENUM('Disponible', 'En_Uso', 'Descanso', 'Mantenimiento') DEFAULT 'Disponible',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ubicacion(
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT NOT NULL,
    nombre VARCHAR(30) NOT NULL,
    metros_cuadrados INT NOT NULL CHECK (metros_cuadrados > 0),
    coordenada_x DECIMAL(10,6),
    coordenada_y DECIMAL(10,6),
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_area FOREIGN KEY (area_id) REFERENCES area(id) ON DELETE CASCADE,
    CONSTRAINT uk_ubicacion_area UNIQUE (area_id, nombre)
);


CREATE TABLE tarea(
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT NOT NULL,
    ubicacion_id INT NOT NULL,
    inicio DATETIME NOT NULL,
    fin DATETIME NULL,
    tipo ENUM('sembrado', 'aplicacion', 'riego', 'cosecha') NOT NULL,
    estado ENUM('Pendiente', 'En_Progreso', 'Completada', 'Cancelada') DEFAULT 'Pendiente',
    descripcion TEXT,
    costo_estimado DECIMAL(10,2) DEFAULT 0.00 CHECK (costo_estimado >= 0),
    costo_real DECIMAL(10,2) DEFAULT 0.00 CHECK (costo_real >= 0),
    prioridad ENUM('Baja', 'Media', 'Alta', 'Urgente') DEFAULT 'Media',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tarea_area FOREIGN KEY (area_id) REFERENCES area(id) ON DELETE CASCADE,
    CONSTRAINT fk_tarea_ubicacion FOREIGN KEY (ubicacion_id) REFERENCES ubicacion(id) ON DELETE CASCADE,
    CONSTRAINT chk_fechas CHECK (fin IS NULL OR fin >= inicio)
);

CREATE TABLE registro(
    empleado_id CHAR(10),
    tarea_id INT,
    fecha_asignacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    horas_trabajadas DECIMAL(5,2) DEFAULT 0.00 CHECK (horas_trabajadas >= 0),
    rol_en_tarea ENUM('Supervisor', 'Trabajador', 'Asistente') DEFAULT 'Trabajador',
    observaciones TEXT,
    activo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (empleado_id, tarea_id),
    CONSTRAINT fk_registro_empleado FOREIGN KEY (empleado_id) REFERENCES persona(cedula) ON DELETE CASCADE,
    CONSTRAINT fk_registro_tarea FOREIGN KEY (tarea_id) REFERENCES tarea(id) ON DELETE CASCADE
);

CREATE TABLE sembrado(
    tarea_id INT PRIMARY KEY,
    tipo_grano VARCHAR(30) NOT NULL DEFAULT 'Arroz',
    variedad VARCHAR(30) NOT NULL,
    kilos_semilla DECIMAL(8,2) NOT NULL CHECK (kilos_semilla > 0),
    densidad_siembra INT DEFAULT 150 CHECK (densidad_siembra > 0),
    metodo_siembra ENUM('Manual', 'Mecanizado', 'Semi-mecanizado') DEFAULT 'Manual',
    profundidad_cm DECIMAL(3,1) DEFAULT 2.5 CHECK (profundidad_cm > 0),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sembrado_tarea FOREIGN KEY (tarea_id) REFERENCES tarea(id) ON DELETE CASCADE
);

CREATE TABLE aplicacion_foliar(
    tarea_id INT PRIMARY KEY,
    producto VARCHAR(50) NOT NULL,
    tipo ENUM('Fertilizante', 'Pesticida', 'Herbicida', 'Fungicida') NOT NULL,
    concentracion VARCHAR(20),
    cantidad_litros DECIMAL(8,2) NOT NULL CHECK (cantidad_litros > 0),
    costo_por_litro DECIMAL(6,2) DEFAULT 0.00 CHECK (costo_por_litro >= 0),
    hora_aplicacion TIME NOT NULL,
    condicion_clima ENUM('Soleado', 'Nublado', 'Parcialmente_nublado', 'Lluvia_ligera') DEFAULT 'Soleado',
    equipo_usado VARCHAR(50) DEFAULT 'Bomba manual',
    temperatura_celsius DECIMAL(4,1),
    humedad_relativa INT CHECK (humedad_relativa BETWEEN 0 AND 100),
    CONSTRAINT fk_aplicacion_tarea FOREIGN KEY (tarea_id) REFERENCES tarea(id) ON DELETE CASCADE
);

CREATE TABLE riego(
    tarea_id INT PRIMARY KEY,
    agua_aplicada_litros INT NOT NULL CHECK (agua_aplicada_litros > 0),
    tanques_gas_usados INT DEFAULT 1 CHECK (tanques_gas_usados > 0),
    costo_combustible DECIMAL(8,2) DEFAULT 0.00 CHECK (costo_combustible >= 0),
    presion_bomba DECIMAL(4,1) DEFAULT 2.5 CHECK (presion_bomba > 0),
    tiempo_riego_minutos INT NOT NULL CHECK (tiempo_riego_minutos > 0),
    nivel_agua_inicial_cm DECIMAL(4,1) DEFAULT 0.0,
    nivel_agua_final_cm DECIMAL(4,1),
    metodo_riego ENUM('Inundacion', 'Aspersion', 'Goteo', 'Intermitente') DEFAULT 'Inundacion',
    CONSTRAINT fk_riego_tarea FOREIGN KEY (tarea_id) REFERENCES tarea(id) ON DELETE CASCADE
);

CREATE TABLE cosecha(
    tarea_id INT PRIMARY KEY,
    torvadas_obtenidas DECIMAL(10,2) NOT NULL CHECK (torvadas_obtenidas > 0),
    kilos_equivalentes DECIMAL(12,2) GENERATED ALWAYS AS (torvadas_obtenidas * 181.4) STORED,
    maquinarias_usadas INT DEFAULT 1 CHECK (maquinarias_usadas > 0),
    costo_maquinaria DECIMAL(10,2) DEFAULT 0.00 CHECK (costo_maquinaria >= 0),
    humedad_porcentaje DECIMAL(4,2) DEFAULT 14.00 CHECK (humedad_porcentaje BETWEEN 10 AND 25),
    calidad ENUM('Primera', 'Segunda', 'Tercera', 'Industrial') DEFAULT 'Primera',
    precio_venta_torvada DECIMAL(8,2) DEFAULT 0.00 CHECK (precio_venta_torvada >= 0),
    rendimiento_hectarea DECIMAL(8,2) DEFAULT 0.00,
    perdidas_kg DECIMAL(8,2) DEFAULT 0.00 CHECK (perdidas_kg >= 0),
    CONSTRAINT fk_cosecha_tarea FOREIGN KEY (tarea_id) REFERENCES tarea(id) ON DELETE CASCADE
);

CREATE TABLE auditoria_log(
    id INT AUTO_INCREMENT PRIMARY KEY,
    tabla VARCHAR(50) NOT NULL,
    accion VARCHAR(20) NOT NULL,
    usuario VARCHAR(100) NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    registro_id VARCHAR(50),
    valores_anteriores JSON,
    valores_nuevos JSON,
    ip_address VARCHAR(45),
    detalles TEXT,
    INDEX idx_auditoria_fecha (fecha),
    INDEX idx_auditoria_tabla (tabla),
    INDEX idx_auditoria_usuario (usuario)
);


-- Insertar áreas
INSERT INTO area (nombre, hectareas, tipo_suelo, estado) VALUES
('Campo Norte', 5.5, 'Arcilloso', 'En_Uso'),
('Campo Sur', 4.2, 'Franco', 'En_Uso'),
('Campo Este', 3.8, 'Limoso', 'Disponible'),
('Campo Oeste', 4.0, 'Arenoso', 'Mantenimiento');

-- Insertar ubicaciones
INSERT INTO ubicacion (area_id, nombre, metros_cuadrados, coordenada_x, coordenada_y) VALUES
(1, 'Lote A1', 5000, -2.185400, -79.886600),
(1, 'Lote A2', 4500, -2.186000, -79.887000),
(1, 'Lote A3', 4000, -2.186500, -79.887500),
(2, 'Lote B1', 4200, -2.187000, -79.888000),
(2, 'Lote B2', 3800, -2.187500, -79.888500),
(3, 'Lote C1', 3800, -2.188000, -79.889000),
(4, 'Lote D1', 4000, -2.188500, -79.889500);

-- Insertar empleados (supervisor primero para evitar error FK)
INSERT INTO persona (cedula, nombre, telefono, email, fecha_contrato, salario_diario, especialidad, estado, jefe) VALUES
('0930492392', 'Kevin Mejía', '0991234567', 'kevin@cultivo.com', '2023-01-15', 35.00, 'Supervisor', 'Activo', NULL);

INSERT INTO persona (cedula, nombre, telefono, email, fecha_contrato, salario_diario, especialidad, estado, jefe) VALUES
('0925738347', 'Bob Martínez', '0991234568', 'bob@cultivo.com', '2023-02-01', 18.00, 'Sembrado', 'Activo', '0930492392'),
('0946195734', 'Charlie López', '0991234569', 'charlie@cultivo.com', '2023-02-15', 20.00, 'Aplicacion', 'Activo', '0930492392'),
('0285038323', 'David García', '0991234570', 'david@cultivo.com', '2023-03-01', 17.00, 'Riego', 'Activo', '0930492392'),
('0782415632', 'Eve Rodríguez', '0991234571', 'eve@cultivo.com', '2023-03-15', 22.00, 'Cosecha', 'Activo', '0930492392'),
('0923456789', 'Ana Torres', '0991234572', 'ana@cultivo.com', '2023-04-01', 19.00, 'General', 'Activo', '0930492392');

-- Insertar tareas
INSERT INTO tarea (area_id, ubicacion_id, inicio, fin, tipo, estado, descripcion, costo_estimado, costo_real, prioridad) VALUES
(1, 1, '2024-01-15 07:00:00', '2024-01-15 15:00:00', 'sembrado', 'Completada', 'Siembra de arroz variedad INIAP-14', 150.00, 145.50, 'Alta'),
(1, 2, '2024-01-16 08:00:00', '2024-01-16 16:00:00', 'sembrado', 'Completada', 'Siembra de arroz variedad IR64', 160.00, 158.00, 'Alta'),
(1, 1, '2024-02-01 06:00:00', '2024-02-01 10:00:00', 'aplicacion', 'Completada', 'Aplicación de fertilizante 20-10-10', 80.00, 75.00, 'Media'),
(2, 4, '2024-02-15 05:30:00', '2024-02-15 11:30:00', 'riego', 'Completada', 'Riego de mantenimiento', 45.00, 42.00, 'Alta'),
(2, 5, '2024-05-01 06:00:00', '2024-05-03 18:00:00', 'cosecha', 'Completada', 'Cosecha temporada 2024-1', 300.00, 285.00, 'Urgente'),
(3, 6, '2024-06-01 07:00:00', NULL, 'sembrado', 'Pendiente', 'Siembra programada Campo Este', 140.00, 0.00, 'Media');

-- Insertar registros empleado-tarea
INSERT INTO registro (empleado_id, tarea_id, fecha_asignacion, horas_trabajadas, rol_en_tarea, observaciones) VALUES
('0925738347', 1, '2024-01-15 06:30:00', 8.0, 'Trabajador', 'Excelente trabajo en la siembra'),
('0930492392', 1, '2024-01-15 06:30:00', 8.0, 'Supervisor', 'Supervisión y control de calidad'),
('0925738347', 2, '2024-01-16 07:30:00', 8.0, 'Trabajador', 'Siembra completada según cronograma'),
('0946195734', 3, '2024-02-01 05:45:00', 4.0, 'Trabajador', 'Aplicación precisa del fertilizante'),
('0285038323', 4, '2024-02-15 05:00:00', 6.0, 'Trabajador', 'Riego completado sin inconvenientes'),
('0782415632', 5, '2024-05-01 05:30:00', 36.0, 'Trabajador', 'Cosecha exitosa, muy buen rendimiento'),
('0930492392', 5, '2024-05-01 05:30:00', 36.0, 'Supervisor', 'Supervisión general de cosecha');

-- Insertar actividades específicas
INSERT INTO sembrado (tarea_id, tipo_grano, variedad, kilos_semilla, densidad_siembra, metodo_siembra, profundidad_cm) VALUES
(1, 'Arroz', 'INIAP-14', 125.5, 150, 'Manual', 2.5),
(2, 'Arroz', 'IR64', 135.0, 160, 'Manual', 2.0),
(6, 'Arroz', 'INIAP-15', 120.0, 145, 'Semi-mecanizado', 2.2);

INSERT INTO aplicacion_foliar (tarea_id, producto, tipo, concentracion, cantidad_litros, costo_por_litro, hora_aplicacion, condicion_clima, equipo_usado, temperatura_celsius, humedad_relativa) VALUES
(3, 'Urea + Completo', 'Fertilizante', '20-10-10', 45.5, 1.65, '07:30:00', 'Soleado', 'Bomba de motor', 28.5, 65);

INSERT INTO riego (tarea_id, agua_aplicada_litros, tanques_gas_usados, costo_combustible, presion_bomba, tiempo_riego_minutos, nivel_agua_inicial_cm, nivel_agua_final_cm, metodo_riego) VALUES
(4, 15000, 2, 12.50, 2.8, 180, 0.5, 2.5, 'Inundacion');

INSERT INTO cosecha (tarea_id, torvadas_obtenidas, maquinarias_usadas, costo_maquinaria, humedad_porcentaje, calidad, precio_venta_torvada, perdidas_kg) VALUES
(5, 28.5, 3, 180.00, 14.2, 'Primera', 32.50, 45.20);

DELIMITER $$

-- Trigger para actualizar rendimiento automáticamente
CREATE TRIGGER tr_actualizar_rendimiento_insert
AFTER INSERT ON cosecha
FOR EACH ROW
BEGIN
    UPDATE cosecha c
    JOIN tarea t ON c.tarea_id = t.id
    JOIN area a ON t.area_id = a.id
    SET c.rendimiento_hectarea = ROUND(c.kilos_equivalentes / a.hectareas, 2)
    WHERE c.tarea_id = NEW.tarea_id;
END$$

CREATE TRIGGER tr_actualizar_rendimiento_update
AFTER UPDATE ON cosecha
FOR EACH ROW
BEGIN
    UPDATE cosecha c
    JOIN tarea t ON c.tarea_id = t.id
    JOIN area a ON t.area_id = a.id
    SET c.rendimiento_hectarea = ROUND(c.kilos_equivalentes / a.hectareas, 2)
    WHERE c.tarea_id = NEW.tarea_id;
END$$

-- Trigger de auditoría para tareas completadas
CREATE TRIGGER tr_auditoria_tarea_completada
AFTER UPDATE ON tarea
FOR EACH ROW
BEGIN
    IF NEW.estado = 'Completada' AND OLD.estado != 'Completada' THEN
        INSERT INTO auditoria_log (tabla, accion, usuario, registro_id, valores_anteriores, valores_nuevos, detalles)
        VALUES ('tarea', 'COMPLETADA', USER(), NEW.id, 
                JSON_OBJECT('estado_anterior', OLD.estado, 'fin_anterior', OLD.fin),
                JSON_OBJECT('estado_nuevo', NEW.estado, 'fin_nuevo', NEW.fin),
                CONCAT('Tarea ID: ', NEW.id, ' completada en área: ', NEW.area_id));
    END IF;
END$$

-- Trigger para validar costo real
CREATE TRIGGER tr_validar_costo_real
BEFORE UPDATE ON tarea
FOR EACH ROW
BEGIN
    IF NEW.costo_real > (NEW.costo_estimado * 2.0) AND NEW.costo_estimado > 0 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Costo real excede el 200% del costo estimado. Revisar con supervisor.';
    END IF;
END$$

-- Trigger de auditoría para empleados
CREATE TRIGGER tr_auditoria_empleado_cambio
AFTER UPDATE ON persona
FOR EACH ROW
BEGIN
    INSERT INTO auditoria_log (tabla, accion, usuario, registro_id, valores_anteriores, valores_nuevos, detalles)
    VALUES ('persona', 'UPDATE', USER(), NEW.cedula,
            JSON_OBJECT('salario', OLD.salario_diario, 'estado', OLD.estado, 'especialidad', OLD.especialidad),
            JSON_OBJECT('salario', NEW.salario_diario, 'estado', NEW.estado, 'especialidad', NEW.especialidad),
            CONCAT('Actualización empleado: ', NEW.nombre));
END$$

DELIMITER ;

CREATE VIEW vista_cosecha_completa AS
SELECT 
    c.*,
    t.descripcion as descripcion_tarea,
    a.nombre as nombre_area,
    a.hectareas,
    u.nombre as nombre_ubicacion,
    ROUND(c.kilos_equivalentes / a.hectareas, 2) AS rendimiento_calculado,
    ROUND((c.precio_venta_torvada * c.torvadas_obtenidas), 2) AS ingreso_bruto,
    ROUND((c.precio_venta_torvada * c.torvadas_obtenidas) - t.costo_real, 2) AS ganancia_neta,
    ROUND(c.perdidas_kg / c.kilos_equivalentes * 100, 2) AS porcentaje_perdidas
FROM cosecha c
JOIN tarea t ON c.tarea_id = t.id
JOIN area a ON t.area_id = a.id
JOIN ubicacion u ON t.ubicacion_id = u.id;

-- Vista de productividad por empleado
CREATE VIEW vista_productividad_empleado AS
SELECT 
    p.cedula,
    p.nombre,
    p.especialidad,
    p.salario_diario,
    COUNT(DISTINCT r.tarea_id) as total_tareas_asignadas,
    SUM(r.horas_trabajadas) as horas_totales,
    ROUND(AVG(r.horas_trabajadas), 2) as promedio_horas_por_tarea,
    COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) as tareas_completadas,
    ROUND(COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) / COUNT(DISTINCT r.tarea_id) * 100, 2) as porcentaje_exito
FROM persona p
LEFT JOIN registro r ON p.cedula = r.empleado_id
LEFT JOIN tarea t ON r.tarea_id = t.id
WHERE p.estado = 'Activo'
GROUP BY p.cedula, p.nombre, p.especialidad, p.salario_diario;

-- Vista resumen por área
CREATE VIEW vista_resumen_area AS
SELECT 
    a.id,
    a.nombre,
    a.hectareas,
    a.tipo_suelo,
    COUNT(DISTINCT u.id) as total_ubicaciones,
    COUNT(DISTINCT t.id) as total_tareas,
    COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) as tareas_completadas,
    ROUND(SUM(CASE WHEN t.estado = 'Completada' THEN c.kilos_equivalentes ELSE 0 END), 2) as total_kilos_cosechados,
    ROUND(SUM(CASE WHEN t.estado = 'Completada' THEN t.costo_real ELSE 0 END), 2) as costo_total_invertido
FROM area a
LEFT JOIN ubicacion u ON a.id = u.area_id AND u.activo = TRUE
LEFT JOIN tarea t ON a.id = t.area_id
LEFT JOIN cosecha c ON t.id = c.tarea_id
GROUP BY a.id, a.nombre, a.hectareas, a.tipo_suelo;


-- PROCEDIMIENTOS ALMACENADOS MEJORADOS

DELIMITER $$

CREATE PROCEDURE sp_calcular_productividad_empleado_mejorado(
    IN p_cedula CHAR(10),
    IN p_fecha_inicio DATE,
    IN p_fecha_fin DATE
)
BEGIN
    DECLARE empleado_existe INT DEFAULT 0;
    
    -- Verificar si el empleado existe
    SELECT COUNT(*) INTO empleado_existe
    FROM persona WHERE cedula = p_cedula;
    
    IF empleado_existe = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Empleado no encontrado';
    END IF;
    
    SELECT 
        p.cedula,
        p.nombre,
        p.especialidad,
        p.salario_diario,
        COUNT(DISTINCT r.tarea_id) as total_tareas,
        SUM(r.horas_trabajadas) as horas_totales,
        ROUND(AVG(r.horas_trabajadas), 2) as promedio_horas_tarea,
        SUM(t.costo_real) as costo_total_generado,
        ROUND(SUM(r.horas_trabajadas * p.salario_diario / 8), 2) as costo_mano_obra,
        COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) as tareas_completadas,
        ROUND(COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) / COUNT(DISTINCT r.tarea_id) * 100, 2) as porcentaje_exito
    FROM persona p
    JOIN registro r ON p.cedula = r.empleado_id
    JOIN tarea t ON r.tarea_id = t.id
    WHERE p.cedula = p_cedula 
    AND DATE(t.inicio) BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY p.cedula, p.nombre, p.especialidad, p.salario_diario;
END$$

CREATE PROCEDURE sp_asignar_tarea_automatica_mejorada(
    IN p_tipo_tarea ENUM('sembrado', 'aplicacion', 'riego', 'cosecha'),
    IN p_area_id INT,
    IN p_ubicacion_id INT,
    IN p_descripcion TEXT,
    IN p_prioridad ENUM('Baja', 'Media', 'Alta', 'Urgente')
)
BEGIN
    DECLARE v_empleado_cedula CHAR(10) DEFAULT NULL;
    DECLARE v_tarea_id INT;
    DECLARE area_existe INT DEFAULT 0;
    DECLARE ubicacion_existe INT DEFAULT 0;
    
  
    SELECT COUNT(*) INTO area_existe FROM area WHERE id = p_area_id;
    SELECT COUNT(*) INTO ubicacion_existe FROM ubicacion WHERE id = p_ubicacion_id AND area_id = p_area_id;
    
    IF area_existe = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Área no encontrada';
    END IF;
    
    IF ubicacion_existe = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ubicación no válida para el área especificada';
    END IF;
    
    -- Buscar empleado especializado disponible con menos carga de trabajo
    SELECT p.cedula INTO v_empleado_cedula
    FROM persona p
    LEFT JOIN registro r ON p.cedula = r.empleado_id 
    LEFT JOIN tarea t ON r.tarea_id = t.id AND t.estado IN ('Pendiente', 'En_Progreso')
    WHERE p.especialidad = CASE 
        WHEN p_tipo_tarea = 'sembrado' THEN 'Sembrado'
        WHEN p_tipo_tarea = 'aplicacion' THEN 'Aplicacion'
        WHEN p_tipo_tarea = 'riego' THEN 'Riego'
        WHEN p_tipo_tarea = 'cosecha' THEN 'Cosecha'
        ELSE 'General'
    END
    AND p.estado = 'Activo'
    GROUP BY p.cedula
    ORDER BY COUNT(t.id) ASC, p.salario_diario ASC
    LIMIT 1;
    
    -- Si no hay especialista, buscar trabajador general
    IF v_empleado_cedula IS NULL THEN
        SELECT p.cedula INTO v_empleado_cedula
        FROM persona p
        LEFT JOIN registro r ON p.cedula = r.empleado_id 
        LEFT JOIN tarea t ON r.tarea_id = t.id AND t.estado IN ('Pendiente', 'En_Progreso')
        WHERE p.especialidad IN ('General', 'Supervisor')
        AND p.estado = 'Activo'
        GROUP BY p.cedula
        ORDER BY COUNT(t.id) ASC, p.salario_diario ASC
        LIMIT 1;
    END IF;
    
    IF v_empleado_cedula IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No hay empleados disponibles para esta tarea';
    END IF;
    
    -- Crear nueva tarea
    INSERT INTO tarea (area_id, ubicacion_id, inicio, tipo, estado, descripcion, prioridad, costo_estimado)
    VALUES (p_area_id, p_ubicacion_id, NOW(), p_tipo_tarea, 'Pendiente', p_descripcion, p_prioridad, 
            CASE 
                WHEN p_tipo_tarea = 'sembrado' THEN 120.00
                WHEN p_tipo_tarea = 'aplicacion' THEN 75.00
                WHEN p_tipo_tarea = 'riego' THEN 50.00
                WHEN p_tipo_tarea = 'cosecha' THEN 250.00
                ELSE 100.00
            END);
    
    SET v_tarea_id = LAST_INSERT_ID();
    
    -- Asignar empleado a la tarea
    INSERT INTO registro (empleado_id, tarea_id, fecha_asignacion, rol_en_tarea)
    VALUES (v_empleado_cedula, v_tarea_id, NOW(), 'Trabajador');
    
    SELECT 
        v_tarea_id as tarea_id,
        v_empleado_cedula as empleado_asignado,
        (SELECT nombre FROM persona WHERE cedula = v_empleado_cedula) as nombre_empleado,
        p_tipo_tarea as tipo_tarea,
        'Tarea creada y asignada exitosamente' as resultado;
END$

-- Procedimiento para procesar cosecha completa con validaciones
CREATE PROCEDURE sp_procesar_cosecha_completa_mejorada(
    IN p_tarea_id INT,
    IN p_torvadas DECIMAL(10,2),
    IN p_maquinarias INT,
    IN p_costo DECIMAL(10,2),
    IN p_calidad ENUM('Primera', 'Segunda', 'Tercera', 'Industrial'),
    IN p_precio_venta DECIMAL(8,2)
)
BEGIN
    DECLARE v_tarea_existe INT DEFAULT 0;
    DECLARE v_tarea_tipo VARCHAR(20);
    DECLARE v_tarea_estado VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        GET DIAGNOSTICS CONDITION 1
            @sqlstate = RETURNED_SQLSTATE, 
            @errno = MYSQL_ERRNO, 
            @text = MESSAGE_TEXT;
        SELECT CONCAT('Error: ', @errno, ' - ', @text) as error_message;
    END;
    
    -- Verificar que la tarea existe y es de tipo cosecha
    SELECT COUNT(*), tipo, estado INTO v_tarea_existe, v_tarea_tipo, v_tarea_estado
    FROM tarea 
    WHERE id = p_tarea_id;
    
    IF v_tarea_existe = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tarea no encontrada';
    END IF;
    
    IF v_tarea_tipo != 'cosecha' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La tarea no es de tipo cosecha';
    END IF;
    
    IF v_tarea_estado = 'Completada' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La tarea ya está completada';
    END IF;
    
    START TRANSACTION;
    
    -- Actualizar estado de tarea
    UPDATE tarea 
    SET estado = 'Completada', 
        fin = NOW(), 
        costo_real = p_costo
    WHERE id = p_tarea_id;
    
    -- Registrar datos de cosecha
    INSERT INTO cosecha (tarea_id, torvadas_obtenidas, maquinarias_usadas, costo_maquinaria, calidad, precio_venta_torvada)
    VALUES (p_tarea_id, p_torvadas, p_maquinarias, p_costo, p_calidad, p_precio_venta);
    
    -- Actualizar horas trabajadas basado en duración real
    UPDATE registro r
    JOIN tarea t ON r.tarea_id = t.id
    SET r.horas_trabajadas = GREATEST(
        TIMESTAMPDIFF(HOUR, t.inicio, t.fin),
        r.horas_trabajadas
    )
    WHERE r.tarea_id = p_tarea_id;
    
    COMMIT;
    
    -- Retornar resumen
    SELECT 
        p_tarea_id as tarea_id,
        p_torvadas as torvadas_cosechadas,
        ROUND(p_torvadas * 181.4, 2) as kilos_equivalentes,
        ROUND(p_torvadas * p_precio_venta, 2) as ingreso_bruto,
        ROUND((p_torvadas * p_precio_venta) - p_costo, 2) as ganancia_neta,
        p_calidad as calidad,
        'Cosecha procesada exitosamente' as resultado;
END$

-- Procedimiento para reporte de rentabilidad por período
CREATE PROCEDURE sp_reporte_rentabilidad_periodo(
    IN p_fecha_inicio DATE,
    IN p_fecha_fin DATE
)
BEGIN
    SELECT 
        'RESUMEN DE RENTABILIDAD' as titulo,
        p_fecha_inicio as fecha_inicio,
        p_fecha_fin as fecha_fin;
    
    -- Resumen general
    SELECT 
        COUNT(DISTINCT t.id) as total_tareas_completadas,
        COUNT(DISTINCT CASE WHEN t.tipo = 'cosecha' THEN t.id END) as cosechas_realizadas,
        ROUND(SUM(t.costo_real), 2) as costo_total_operaciones,
        ROUND(SUM(CASE WHEN c.tarea_id IS NOT NULL THEN c.torvadas_obtenidas * c.precio_venta_torvada ELSE 0 END), 2) as ingreso_total_ventas,
        ROUND(SUM(CASE WHEN c.tarea_id IS NOT NULL THEN (c.torvadas_obtenidas * c.precio_venta_torvada) - t.costo_real ELSE -t.costo_real END), 2) as ganancia_neta_periodo
    FROM tarea t
    LEFT JOIN cosecha c ON t.id = c.tarea_id
    WHERE t.estado = 'Completada'
    AND DATE(t.fin) BETWEEN p_fecha_inicio AND p_fecha_fin;
    
    -- Rentabilidad por área
    SELECT 
        a.nombre as area,
        COUNT(DISTINCT t.id) as tareas_completadas,
        ROUND(SUM(t.costo_real), 2) as costo_invertido,
        ROUND(SUM(CASE WHEN c.tarea_id IS NOT NULL THEN c.torvadas_obtenidas * c.precio_venta_torvada ELSE 0 END), 2) as ingresos,
        ROUND(SUM(CASE WHEN c.tarea_id IS NOT NULL THEN (c.torvadas_obtenidas * c.precio_venta_torvada) - t.costo_real ELSE -t.costo_real END), 2) as ganancia_neta,
        ROUND(SUM(CASE WHEN c.tarea_id IS NOT NULL THEN c.kilos_equivalentes ELSE 0 END), 2) as total_kilos_cosechados
    FROM area a
    LEFT JOIN tarea t ON a.id = t.area_id AND t.estado = 'Completada' AND DATE(t.fin) BETWEEN p_fecha_inicio AND p_fecha_fin
    LEFT JOIN cosecha c ON t.id = c.tarea_id
    GROUP BY a.id, a.nombre
    HAVING tareas_completadas > 0
    ORDER BY ganancia_neta DESC;
END$

DELIMITER ;

DELIMITER $

CREATE FUNCTION fn_calcular_costo_mano_obra(p_tarea_id INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_costo_total DECIMAL(10,2) DEFAULT 0.00;
    
    SELECT COALESCE(SUM(r.horas_trabajadas * p.salario_diario / 8), 0)
    INTO v_costo_total
    FROM registro r
    JOIN persona p ON r.empleado_id = p.cedula
    WHERE r.tarea_id = p_tarea_id;
    
    RETURN v_costo_total;
END$

CREATE FUNCTION fn_dias_desde_siembra(p_area_id INT)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_dias INT DEFAULT 0;
    
    SELECT DATEDIFF(CURDATE(), MAX(t.inicio))
    INTO v_dias
    FROM tarea t
    WHERE t.area_id = p_area_id 
    AND t.tipo = 'sembrado' 
    AND t.estado = 'Completada';
    
    RETURN COALESCE(v_dias, 0);
END$

DELIMITER ;

CREATE INDEX idx_tarea_fecha_tipo ON tarea(inicio, tipo, estado);
CREATE INDEX idx_tarea_area_estado ON tarea(area_id, estado);
CREATE INDEX idx_persona_especialidad_estado ON persona(especialidad, estado);
CREATE INDEX idx_cosecha_rendimiento ON cosecha(rendimiento_hectarea);
CREATE INDEX idx_registro_horas_fecha ON registro(horas_trabajadas, fecha_asignacion);
CREATE INDEX idx_auditoria_fecha_tabla ON auditoria_log(fecha, tabla);

-- Índices compuestos para consultas frecuentes
CREATE INDEX idx_tarea_completa ON tarea(area_id, tipo, estado, inicio);
CREATE INDEX idx_empleado_activo ON persona(estado, especialidad, salario_diario);




CREATE USER IF NOT EXISTS 'jefe_cultivo'@'localhost' IDENTIFIED BY 'admin123';
CREATE USER IF NOT EXISTS 'supervisor'@'localhost' IDENTIFIED BY 'super123';
CREATE USER IF NOT EXISTS 'trabajador'@'localhost' IDENTIFIED BY 'work123';
CREATE USER IF NOT EXISTS 'consulta'@'localhost' IDENTIFIED BY 'read123';

-- 3. ASIGNAR PRIVILEGIOS (ejecutar después de crear usuarios exitosamente)

-- JEFE DE CULTIVO: Acceso completo
GRANT ALL PRIVILEGES ON Cultivo_Arroz.* TO 'jefe_cultivo'@'localhost';

-- SUPERVISOR: Puede gestionar tareas y ver reportes  
GRANT SELECT, INSERT, UPDATE, DELETE ON Cultivo_Arroz.tarea TO 'supervisor'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON Cultivo_Arroz.registro TO 'supervisor'@'localhost';
GRANT SELECT, INSERT, UPDATE ON Cultivo_Arroz.sembrado TO 'supervisor'@'localhost';
GRANT SELECT, INSERT, UPDATE ON Cultivo_Arroz.aplicacion_foliar TO 'supervisor'@'localhost';
GRANT SELECT, INSERT, UPDATE ON Cultivo_Arroz.riego TO 'supervisor'@'localhost';
GRANT SELECT, INSERT, UPDATE ON Cultivo_Arroz.cosecha TO 'supervisor'@'localhost';
GRANT SELECT ON Cultivo_Arroz.persona TO 'supervisor'@'localhost';
GRANT SELECT ON Cultivo_Arroz.area TO 'supervisor'@'localhost';
GRANT SELECT ON Cultivo_Arroz.ubicacion TO 'supervisor'@'localhost';

-- TRABAJADOR: Solo puede ver sus tareas y actualizarlas
GRANT SELECT ON Cultivo_Arroz.persona TO 'trabajador'@'localhost';
GRANT SELECT ON Cultivo_Arroz.tarea TO 'trabajador'@'localhost';
GRANT SELECT, UPDATE ON Cultivo_Arroz.registro TO 'trabajador'@'localhost';
GRANT SELECT ON Cultivo_Arroz.area TO 'trabajador'@'localhost';
GRANT SELECT ON Cultivo_Arroz.ubicacion TO 'trabajador'@'localhost';

-- CONSULTA: Solo lectura para reportes
GRANT SELECT ON Cultivo_Arroz.* TO 'consulta'@'localhost';

-- 4. APLICAR CAMBIOS
FLUSH PRIVILEGES;

-- DATOS ADICIONALES PARA PRUEBAS COMPLETAS
-- Agregar más tareas para mejor testing
INSERT INTO tarea (area_id, ubicacion_id, inicio, fin, tipo, estado, descripcion, costo_estimado, costo_real, prioridad) VALUES
(3, 6, '2024-03-01 06:00:00', '2024-03-01 14:00:00', 'sembrado', 'Completada', 'Siembra Campo Este - Lote C1', 140.00, 135.00, 'Media'),
(1, 3, '2024-03-15 05:00:00', '2024-03-15 09:00:00', 'aplicacion', 'Completada', 'Aplicación herbicida pre-emergente', 90.00, 85.50, 'Alta'),
(2, 4, '2024-04-01 06:00:00', '2024-04-01 12:00:00', 'riego', 'Completada', 'Riego Campo Sur - Preparación cosecha', 60.00, 55.00, 'Alta'),
(1, 1, '2024-06-15 08:00:00', NULL, 'aplicacion', 'Pendiente', 'Aplicación foliar nutritiva', 70.00, 0.00, 'Media'),
(3, 6, '2024-07-01 05:00:00', NULL, 'riego', 'En_Progreso', 'Riego Campo Este - Crecimiento', 50.00, 25.00, 'Alta');

-- Registros adicionales
INSERT INTO registro (empleado_id, tarea_id, fecha_asignacion, horas_trabajadas, rol_en_tarea, observaciones) VALUES
('0925738347', 7, '2024-03-01 05:30:00', 8.0, 'Trabajador', 'Siembra en Campo Este completada'),
('0946195734', 8, '2024-03-15 04:30:00', 4.0, 'Trabajador', 'Aplicación herbicida exitosa'),
('0285038323', 9, '2024-04-01 05:30:00', 6.0, 'Trabajador', 'Riego pre-cosecha completado'),
('0923456789', 10, '2024-06-15 07:30:00', 0.0, 'Trabajador', 'Tarea asignada - pendiente'),
('0285038323', 11, '2024-07-01 04:30:00', 3.5, 'Trabajador', 'Riego en progreso');

-- Datos específicos adicionales
INSERT INTO sembrado (tarea_id, tipo_grano, variedad, kilos_semilla, densidad_siembra, metodo_siembra, profundidad_cm) VALUES
(7, 'Arroz', 'INIAP-16', 115.0, 145, 'Manual', 2.3);

INSERT INTO aplicacion_foliar (tarea_id, producto, tipo, concentracion, cantidad_litros, costo_por_litro, hora_aplicacion, condicion_clima, equipo_usado) VALUES
(8, 'Glifosato', 'Herbicida', '48% SL', 12.5, 6.80, '06:00:00', 'Nublado', 'Bomba de espalda');

INSERT INTO riego (tarea_id, agua_aplicada_litros, tanques_gas_usados, costo_combustible, presion_bomba, tiempo_riego_minutos, nivel_agua_inicial_cm, nivel_agua_final_cm, metodo_riego) VALUES
(9, 18000, 3, 18.75, 3.0, 240, 1.0, 3.0, 'Inundacion');

  