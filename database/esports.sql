-- =========================================================
-- 1) CREACIÓN DE BASE Y TABLAS
-- =========================================================
DROP DATABASE IF EXISTS esportsespol;
CREATE DATABASE esportsespol;
USE esportsespol;

-- ---------- Dimensión PAISES ----------
CREATE TABLE paises (
  pais_id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE
);

-- ---------- 1) Equipos ----------
CREATE TABLE equipos (
  equipo_id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  pais_id INT NOT NULL,
  FOREIGN KEY (pais_id) REFERENCES paises(pais_id),
  UNIQUE KEY uk_equipos_nombre (nombre)
);

-- ---------- 2) Jugadores ----------
CREATE TABLE jugadores (
  jugador_id INT AUTO_INCREMENT PRIMARY KEY,
  equipo_id INT,
  nombre VARCHAR(100) NOT NULL,
  edad INT,
  nacionalidad_id INT,
  trabajo_en_equipo INT,
  FOREIGN KEY (equipo_id) REFERENCES equipos(equipo_id),
  FOREIGN KEY (nacionalidad_id) REFERENCES paises(pais_id)
);

-- ---------- 3) Historial jugador-equipo ----------
CREATE TABLE jugador_equipos (
  jugador_equipo_id INT AUTO_INCREMENT PRIMARY KEY,
  jugador_id INT NOT NULL,
  equipo_id INT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  rol_en_equipo VARCHAR(50),
  FOREIGN KEY (jugador_id) REFERENCES jugadores(jugador_id),
  FOREIGN KEY (equipo_id) REFERENCES equipos(equipo_id)
);

-- ---------- 4) Competencias ----------
CREATE TABLE competencias (
  competencia_id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  ubicacion VARCHAR(100),
  premio_total DECIMAL(12,2),
  tipo ENUM('Nacional','Internacional') NOT NULL
);

-- ---------- 5) Equipos en competencias ----------
CREATE TABLE competencia_equipos (
  competencia_id INT NOT NULL,
  equipo_id INT NOT NULL,
  posicion_final INT,
  premio_obtenido DECIMAL(12,2) DEFAULT 0,
  PRIMARY KEY (competencia_id, equipo_id),
  FOREIGN KEY (competencia_id) REFERENCES competencias(competencia_id),
  FOREIGN KEY (equipo_id) REFERENCES equipos(equipo_id)
);

-- ---------- 6) Rosters ----------
CREATE TABLE rosters (
  roster_id INT AUTO_INCREMENT PRIMARY KEY,
  jugador_id INT NOT NULL,
  competencia_id INT NOT NULL,
  equipo_id INT NOT NULL,
  rol ENUM('Titular','Suplente') NOT NULL,
  FOREIGN KEY (jugador_id) REFERENCES jugadores(jugador_id),
  FOREIGN KEY (competencia_id) REFERENCES competencias(competencia_id),
  FOREIGN KEY (equipo_id) REFERENCES equipos(equipo_id)
);

-- ---------- 7) Partidos ----------
CREATE TABLE partidos (
  partido_id INT AUTO_INCREMENT PRIMARY KEY,
  competencia_id INT NOT NULL,
  etapa VARCHAR(50) NOT NULL,
  fecha DATETIME NOT NULL,
  mejor_de INT NOT NULL DEFAULT 1,
  ganador_equipo_id INT,
  FOREIGN KEY (competencia_id) REFERENCES competencias(competencia_id),
  FOREIGN KEY (ganador_equipo_id) REFERENCES equipos(equipo_id)
);

-- ---------- 8) Puntos por equipo en partido ----------
CREATE TABLE partido_equipos (
  partido_id INT NOT NULL,
  equipo_id INT NOT NULL,
  puntos INT NOT NULL DEFAULT 0,
  PRIMARY KEY (partido_id, equipo_id),
  FOREIGN KEY (partido_id) REFERENCES partidos(partido_id),
  FOREIGN KEY (equipo_id) REFERENCES equipos(equipo_id)
);

-- ---------- 9) Estadísticas de jugador ----------
CREATE TABLE estadisticas_jugador (
  estad_id INT AUTO_INCREMENT PRIMARY KEY,
  jugador_id INT NOT NULL,
  anio INT NOT NULL,
  partidos_jugados INT DEFAULT 0,
  partidos_ganados INT DEFAULT 0,
  minutos_jugados INT DEFAULT 0,
  porcentaje_victorias DECIMAL(5,2) DEFAULT 0.00,
  FOREIGN KEY (jugador_id) REFERENCES jugadores(jugador_id)
);

-- =========================================================
-- 2) POBLADO (INSERTS)
-- =========================================================
USE esportsespol;

-- PAISES
INSERT INTO paises (nombre) VALUES
('Ecuador'),('Perú'),('Chile'),('Colombia'),
('Argentina'),('Bolivia'),('Venezuela'),('México');

-- EQUIPOS
INSERT INTO equipos (nombre, pais_id) VALUES
('Guerreros Andinos',1),
('Cóndores del Pacífico',2),
('Dragones de Fuego',3),
('Leones',4),
('Águilas Celestes',5),
('Incas de Hierro',2),
('Halcones del Sur',3),
('Volcanes Andinos',1),
('Piratas del Caribe',4),
('Lobos Urbanos',1),
('Cóndores Rojos',6),
('Caimanes del Orinoco',7),
('Guerreros del Sol',1),
('Jaguares Negros',8),
('Gladiadores Andinos',3);

-- JUGADORES
INSERT INTO jugadores (equipo_id, nombre, edad, nacionalidad_id, trabajo_en_equipo) VALUES
(1,'Andrés Ramírez',22,1,8),
(1,'Luis Quispe',24,1,7),
(1,'Carlos Hernández',21,1,9),
(2,'Matías Rojas',23,2,6),
(2,'Julián Torres',25,2,8),
(3,'Martín González',20,3,7),
(3,'Fernando López',22,3,9),
(4,'Diego Silva',26,4,6),
(4,'Ricardo Flores',23,4,8),
(4,'João Santos',22,4,7),
(5,'Luciano Córdoba',24,5,8),
(5,'Sebastián Valdés',21,5,9),
(6,'Marco Herrera',23,2,7),
(6,'Camilo Ruiz',25,2,6),
(7,'Rodrigo Pérez',22,3,8),
(7,'Esteban Andrade',21,3,9),
(8,'Oscar Mendoza',23,1,7),
(8,'Gustavo Duarte',24,1,8),
(9,'Daniel Moreno',22,4,6),
(9,'Adrián Vega',25,4,7),
(10,'Héctor Ramírez',21,1,9),
(10,'Ignacio Fuentes',23,1,6),
(11,'Pedro Martínez',24,6,8),
(11,'Antonio Benítez',22,6,7),
(11,'José Castillo',21,6,8),
(12,'Mauricio Salazar',23,7,6),
(12,'Rafael Oliveira',25,7,7),
(13,'Pablo Fernández',22,1,8),
(13,'Alejandro Cárdenas',24,1,9),
(14,'Saulo Peña',24,8,9),
(14,'Cristian Méndez',21,8,7),
(15,'Pablo Solei',24,3,9),
(15,'Santiago Vidal',24,3,9);

-- 3) Historial jugador-equipo
INSERT INTO jugador_equipos (jugador_id, equipo_id, fecha_inicio, rol_en_equipo) VALUES
(1, 1, '2023-01-01', 'Titular'),
(2, 1, '2024-02-01', 'Titular'),
(3, 1, '2023-05-01', 'Suplente'),
(4, 2, '2023-01-01', 'Titular'),
(5, 2, '2023-01-01', 'Titular'),
(6, 3, '2023-01-01', 'Titular'),
(7, 3, '2023-01-01', 'Titular'),
(8, 4, '2023-01-01', 'Titular'),
(9, 4, '2023-01-01', 'Titular'),
(10, 4, '2023-01-01', 'Suplente'),
(11, 5, '2023-01-01', 'Titular'),
(12, 5, '2023-01-01', 'Titular'),
(13, 6, '2023-01-01', 'Titular'),
(14, 6, '2023-01-01', 'Titular'),
(15, 7, '2023-01-01', 'Titular'),
(16, 7, '2023-01-01', 'Titular'),
(17, 8, '2023-01-01', 'Titular'),
(18, 8, '2023-01-01', 'Titular'),
(19, 9, '2023-01-01', 'Titular'),
(20, 9, '2023-01-01', 'Titular'),
(21, 10, '2023-01-01', 'Titular'),
(22, 10, '2023-01-01', 'Titular'),
(23, 11, '2023-01-01', 'Titular'),
(24, 11, '2023-01-01', 'Titular'),
(25, 11, '2023-01-01', 'Suplente'),
(26, 12, '2023-01-01', 'Titular'),
(27, 12, '2023-01-01', 'Titular'),
(28, 13, '2023-01-01', 'Titular'),
(29, 13, '2023-01-01', 'Titular'),
(30, 14, '2023-01-01', 'Titular'),
(31, 14, '2023-01-01', 'Titular'),
(32, 15, '2023-01-01', 'Titular'),
(33, 15, '2023-01-01', 'Titular');

-- 4) Competencias (10 torneos)
INSERT INTO competencias (nombre, fecha_inicio, fecha_fin, ubicacion, premio_total, tipo) VALUES
('Copa Andina 2024', '2024-03-01', '2024-03-15', 'Quito', 50000, 'Nacional'),
('Liga del Pacífico 2024', '2024-05-10', '2024-05-25', 'Lima', 75000, 'Internacional'),
('Torneo del Caribe 2024', '2024-07-05', '2024-07-20', 'Cartagena', 60000, 'Nacional'),
('Masters Latam 2025', '2025-03-01', '2024-03-15', 'Buenos Aires', 100000, 'Internacional'),
('Challenger Sur 2025', '2025-08-01', '2024-08-10', 'Santiago', 40000, 'Nacional');

-- 5) Equipos en competencias 
INSERT INTO competencia_equipos (competencia_id, equipo_id, posicion_final, premio_obtenido) VALUES
-- Copa Andina 2024
(1, 1, 1, 25000),
(1, 2, 2, 15000),
(1, 3, 3, 10000),
-- Liga del Pacífico 2024
(2, 4, 1, 35000),
(2, 5, 2, 25000),
(2, 6, 3, 15000),
-- Torneo del Caribe 2024
(3, 7, 1, 25000),
(3, 8, 2, 20000),
(3, 9, 3, 15000),
-- Masters Latam 2025
(4, 10, 1, 45000),
(4, 11, 2, 35000),
(4, 12, 3, 20000),
-- Challenger Sur 2025
(5, 13, 1, 20000),
(5, 14, 2, 12000),
(5, 15, 3, 8000);

-- 6) Rosters (jugadores asignados a cada competencia)
INSERT INTO rosters (jugador_id, competencia_id, equipo_id, rol) VALUES
(1, 1, 1, 'Titular'),
(2, 1, 1, 'Titular'),
(3, 1, 1, 'Suplente'),
(4, 1, 2, 'Titular'),
(5, 1, 2, 'Titular'),
(6, 1, 3, 'Titular'),
(7, 1, 3, 'Titular'),
(7, 1, 3, 'Titular'),
(26, 1, 12, 'Titular'),
(27, 1, 12, 'Titular'),
(8, 2, 4, 'Titular'),
(9, 2, 4, 'Titular'),
(10, 2, 4, 'Suplente'),
(11, 2, 5, 'Titular'),
(12, 2, 5, 'Titular'),
(13, 2, 6, 'Titular'),
(14, 2, 6, 'Titular'),
(28, 2, 13, 'Titular'),
(29, 2, 13, 'Titular'),
(15, 3, 7, 'Titular'),
(16, 3, 7, 'Titular'),
(17, 3, 8, 'Titular'),
(18, 3, 8, 'Titular'),
(19, 3, 9, 'Titular'),
(20, 3, 9, 'Titular'),
(32, 3, 15, 'Titular'),
(33, 3, 15, 'Titular'),
(21, 4, 10, 'Titular'),
(22, 4, 10, 'Titular'),
(23, 4, 11, 'Titular'),
(24, 4, 11, 'Titular'),
(25, 4, 11, 'Suplente'),
(26, 4, 12, 'Titular'),
(27, 4, 12, 'Titular'),
(8, 4, 4, 'Titular'),
(9, 4, 4, 'Titular'),
(10, 4, 4, 'Titular'),
(28, 5, 13, 'Titular'),
(29, 5, 13, 'Titular'),
(30, 5, 14, 'Titular'),
(31, 5, 14, 'Titular'),
(32, 5, 15, 'Titular'),
(33, 5, 15, 'Titular'),
(4, 5, 2, 'Titular'),
(5, 5, 2, 'Titular');

-- 7) Partidos 
INSERT INTO partidos (competencia_id, etapa, fecha, mejor_de, ganador_equipo_id) VALUES
-- Copa Andina 2024
(1, 'Fase de Grupos', '2024-03-05 14:00:00', 1, 1),
(1, 'Semifinal', '2024-03-10 16:00:00', 3, 2),
(1, 'Final', '2024-03-15 19:00:00', 5, 1),
-- Liga del Pacífico 2024
(2, 'Fase de Grupos', '2024-05-12 15:00:00', 1, 4),
(2, 'Semifinal', '2024-05-20 18:00:00', 3, 5),
(2, 'Final', '2024-05-25 20:00:00', 5, 4),
-- Torneo del Caribe 2024
(3, 'Fase de Grupos', '2024-07-07 13:00:00', 1, 7),
(3, 'Semifinal', '2024-07-14 17:00:00', 3, 8),
(3, 'Final', '2024-07-20 21:00:00', 5, 7),
-- Masters Latam 2025
(4, 'Fase de Grupos', '2025-03-03 15:00:00', 1, 10),
(4, 'Semifinal', '2025-03-10 18:00:00', 3, 11),
(4, 'Final', '2025-03-15 20:00:00', 5, 10),
-- Challenger Sur 2025
(5, 'Fase de Grupos', '2025-08-02 15:00:00', 1, 13),
(5, 'Semifinal', '2025-08-07 17:00:00', 3, 14),
(5, 'Final', '2025-08-10 19:00:00', 5, 13);

-- 8) Resultados de partidos 
INSERT INTO partido_equipos (partido_id, equipo_id, puntos) VALUES
-- Copa Andina 2024
(1, 1, 2), (1, 12, 1),
(2, 2, 2), (2, 3, 1),
(3, 1, 2), (3, 2, 1),
-- Liga del Pacífico 2024
(4, 4, 2), (4, 6, 1),
(5, 5, 2), (5, 6, 1),
(6, 4, 2), (6, 5, 1),
-- Torneo del Caribe 2024
(7, 7, 2), (7, 15, 1),
(8, 8, 2), (8, 15, 1),
(9, 7, 2), (9, 8, 1),
-- Masters Latam 2025
(10, 10, 2), (10, 11, 1),
(11, 11, 2), (11, 12, 1),
(12, 10, 2), (12, 4, 1),
-- Challenger Sur 2025
(13, 13, 2), (13, 14, 1),
(14, 14, 2), (14, 13, 1),
(15, 13, 2), (15, 2, 1);

-- 9) Estadísticas del jugador
INSERT INTO estadisticas_jugador (jugador_id, anio, partidos_jugados, partidos_ganados, minutos_jugados, porcentaje_victorias) VALUES
(1, 2024, 25, 18, 1450, 72.0),
(2, 2024, 22, 12, 1200, 54.5),
(3, 2024, 28, 21, 1600, 75.0),
(4, 2024, 20, 11, 1100, 55.0),
(4, 2025, 14, 10, 1100, 71.4),
(5, 2024, 24, 14, 1300, 58.3),
(5, 2025, 20, 18, 1300, 90.0),
(6, 2024, 18, 9, 980, 50.0),
(7, 2024, 27, 20, 1550, 74.0),
(8, 2024, 19, 10, 1050, 52.6),
(8, 2025, 10, 6, 1050, 60.0),
(9, 2024, 23, 15, 1400, 65.2),
(9, 2025, 15, 11, 1400, 73.3),
(10, 2024, 21, 12, 1150, 57.1),
(10, 2025, 16, 10, 1150, 62.5),
(11, 2024, 26, 17, 1500, 65.4),
(12, 2024, 20, 14, 1250, 70.0),
(13, 2024, 22, 13, 1180, 59.1),
(14, 2024, 25, 16, 1400, 64.0),
(15, 2024, 18, 9, 970, 50.0),
(16, 2024, 24, 15, 1350, 62.5),
(17, 2024, 20, 10, 1080, 50.0),
(18, 2024, 21, 11, 1120, 52.4),
(19, 2024, 19, 8, 1020, 42.1),
(20, 2024, 28, 20, 1650, 71.4),
(21, 2024, 23, 14, 1380, 60.9),
(22, 2024, 22, 12, 1210, 54.5),
(23, 2024, 20, 11, 1090, 55.0),
(24, 2024, 19, 9, 980, 47.4),
(25, 2024, 24, 13, 1320, 54.2),
(26, 2024, 21, 12, 1175, 57.1),
(26, 2025, 14, 6, 1175, 42.9),
(27, 2024, 22, 11, 1200, 50.0),
(27, 2025, 18, 13, 1200, 72.2),
(28, 2024, 25, 17, 1480, 68.0),
(28, 2025, 16, 5, 1480, 31.3),
(29, 2024, 20, 15, 1300, 75.0),
(29, 2025, 20, 15, 1300, 75.0),
(30, 2024, 23, 14, 1360, 60.9),
(31, 2025, 20, 14, 1380, 70.0),
(32, 2024, 13, 8, 1380, 61.5),
(32, 2025, 23, 14, 1380, 60.9),
(33, 2024, 23, 14, 1380, 60.9),
(33, 2025, 19, 13, 1380, 68.4);

-- CONSULTAS
-- ¿Qué equipo tiene el mejor desempeño en competencias internacionales?
SELECT e.nombre, SUM(ce.premio_obtenido) AS PremioTotal
FROM competencia_equipos ce
INNER JOIN competencias c ON ce.competencia_id = c.competencia_id
INNER JOIN equipos e      ON ce.equipo_id      = e.equipo_id
WHERE c.tipo = 'Internacional'
GROUP BY e.nombre
ORDER BY PremioTotal DESC
LIMIT 1;


-- ¿Qué jugador tiene el mayor promedio de victorias por temporada?
-- ¿Qué jugador tiene el mayor promedio de victorias por temporada? (2024)
SELECT j.nombre,
       ej.porcentaje_victorias,
       p.nombre AS nacionalidad
FROM jugadores j
JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id
LEFT JOIN paises p           ON j.nacionalidad_id = p.pais_id
WHERE ej.anio = 2024
ORDER BY ej.porcentaje_victorias DESC
LIMIT 1;

-- ¿Qué jugador tiene el mayor promedio de victorias por temporada? (2025)
SELECT j.nombre,
       ej.porcentaje_victorias,
       p.nombre AS nacionalidad
FROM jugadores j
JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id
LEFT JOIN paises p           ON j.nacionalidad_id = p.pais_id
WHERE ej.anio = 2025
ORDER BY ej.porcentaje_victorias DESC
LIMIT 1;

-- Ambos 2024 - 2025 (Top 1 por año; si quieres empates usa DENSE_RANK)
WITH rnk AS (
  SELECT
    j.nombre,
    ej.porcentaje_victorias,
    ej.anio,
    p.nombre AS nacionalidad,
    RANK() OVER (PARTITION BY ej.anio ORDER BY ej.porcentaje_victorias DESC) AS Ranking
  FROM jugadores j
  JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id
  LEFT JOIN paises p           ON j.nacionalidad_id = p.pais_id
)
SELECT *
FROM rnk
WHERE Ranking = 1
ORDER BY anio;


-- ¿Qué competencias tienen mayor participación de equipos?
SELECT c.nombre,
       COUNT(ce.equipo_id) AS Participacion
FROM competencia_equipos ce
JOIN competencias c ON ce.competencia_id = c.competencia_id
GROUP BY c.nombre
ORDER BY Participacion DESC, c.nombre;




# ==========================================================
#                SECCIÓN: OPTIMIZACIÓN DE QUERIES
# ==========================================================

EXPLAIN ANALYZE  -- Antes
SELECT e.nombre, SUM(ce.premio_obtenido) AS premio_total
FROM competencia_equipos ce
JOIN competencias c ON ce.competencia_id = c.competencia_id
JOIN equipos e      ON ce.equipo_id      = e.equipo_id
WHERE c.tipo = 'Internacional'
GROUP BY e.nombre;

-- Crear índice
CREATE INDEX idx_competencias_tipo_compid ON competencias(tipo, competencia_id);

EXPLAIN ANALYZE  -- Después
SELECT e.nombre, SUM(ce.premio_obtenido) AS premio_total
FROM competencia_equipos ce
JOIN competencias c ON ce.competencia_id = c.competencia_id
JOIN equipos e      ON ce.equipo_id      = e.equipo_id
WHERE c.tipo = 'Internacional'
GROUP BY e.nombre;

-- vista 1
CREATE OR REPLACE VIEW vw_competencias_internacionales AS
SELECT competencia_id
FROM competencias
WHERE tipo = 'Internacional';


SELECT * FROM vw_competencias_internacionales;

-- vista 2

CREATE OR REPLACE VIEW vw_premios_internacionales AS
SELECT 
  e.equipo_id,
  e.nombre,
  SUM(ce.premio_obtenido) AS premio_total
FROM competencia_equipos ce
JOIN vw_competencias_internacionales ci 
  ON ce.competencia_id = ci.competencia_id
JOIN equipos e 
  ON ce.equipo_id = e.equipo_id
GROUP BY e.equipo_id, e.nombre;

SELECT * FROM vw_premios_internacionales;

-- vista 3
CREATE OR REPLACE VIEW vw_premios_internacionales_ranked AS
SELECT 
  equipo_id,
  nombre,
  premio_total,
  RANK() OVER (ORDER BY premio_total DESC) AS rnk
FROM vw_premios_internacionales;

SELECT * FROM vw_premios_internacionales_ranked;
-- =========================================================
-- CONSULTAS ADICIONALES PARA DASHBOARD
-- =========================================================

-- 1) Ranking de países por premios totales
SELECT p.nombre AS pais,
       COUNT(DISTINCT e.equipo_id) AS total_equipos,
       COALESCE(SUM(ce.premio_obtenido), 0) AS premios_totales,
       ROUND(AVG(ce.premio_obtenido), 2) AS promedio_por_equipo
FROM paises p
LEFT JOIN equipos e ON p.pais_id = e.pais_id
LEFT JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
GROUP BY p.nombre
ORDER BY premios_totales DESC;

-- 2) Evolución temporal de performance por jugador (2024 vs 2025)
SELECT j.nombre,
       p.nombre AS nacionalidad,
       e2024.porcentaje_victorias AS performance_2024,
       e2025.porcentaje_victorias AS performance_2025,
       CASE 
         WHEN e2025.porcentaje_victorias IS NULL THEN 'Sin datos 2025'
         WHEN e2025.porcentaje_victorias > e2024.porcentaje_victorias THEN 'Mejoró'
         WHEN e2025.porcentaje_victorias < e2024.porcentaje_victorias THEN 'Empeoró'
         ELSE 'Sin cambios'
       END AS tendencia
FROM jugadores j
LEFT JOIN paises p ON j.nacionalidad_id = p.pais_id
LEFT JOIN estadisticas_jugador e2024 ON j.jugador_id = e2024.jugador_id AND e2024.anio = 2024
LEFT JOIN estadisticas_jugador e2025 ON j.jugador_id = e2025.jugador_id AND e2025.anio = 2025
WHERE e2024.porcentaje_victorias IS NOT NULL
ORDER BY e2024.porcentaje_victorias DESC;

-- 3) Análisis de participación titular vs suplente
SELECT 
    r.rol,
    COUNT(*) AS total_participaciones,
    COUNT(DISTINCT r.jugador_id) AS jugadores_unicos,
    ROUND(AVG(ej.porcentaje_victorias), 2) AS promedio_performance
FROM rosters r
JOIN estadisticas_jugador ej ON r.jugador_id = ej.jugador_id
WHERE ej.anio = 2024
GROUP BY r.rol
ORDER BY promedio_performance DESC;

-- 4) Top 5 equipos más exitosos (considerando posiciones)
SELECT e.nombre,
       p.nombre AS pais,
       COUNT(ce.competencia_id) AS competencias_participadas,
       ROUND(AVG(ce.posicion_final), 2) AS posicion_promedio,
       SUM(ce.premio_obtenido) AS premios_totales
FROM equipos e
JOIN paises p ON e.pais_id = p.pais_id
JOIN competencia_equipos ce ON e.equipo_id = ce.equipo_id
GROUP BY e.equipo_id, e.nombre, p.nombre
HAVING competencias_participadas >= 1
ORDER BY posicion_promedio ASC, premios_totales DESC
LIMIT 5;

-- 5) Competencias más competitivas (por número de participantes)
SELECT c.nombre,
       c.tipo,
       c.ubicacion,
       COUNT(ce.equipo_id) AS equipos_participantes,
       c.premio_total,
       ROUND(c.premio_total / COUNT(ce.equipo_id), 2) AS premio_promedio_por_equipo
FROM competencias c
JOIN competencia_equipos ce ON c.competencia_id = ce.competencia_id
GROUP BY c.competencia_id
ORDER BY equipos_participantes DESC, premio_total DESC;

-- 6) Jugadores más veteranos por equipo
SELECT e.nombre AS equipo,
       p.nombre AS pais,
       j.nombre AS jugador_veterano,
       j.edad,
       ej.porcentaje_victorias AS performance_2024
FROM equipos e
JOIN paises p ON e.pais_id = p.pais_id
JOIN jugadores j ON e.equipo_id = j.equipo_id
LEFT JOIN estadisticas_jugador ej ON j.jugador_id = ej.jugador_id AND ej.anio = 2024
WHERE j.edad = (
    SELECT MAX(j2.edad)
    FROM jugadores j2
    WHERE j2.equipo_id = e.equipo_id
)
ORDER BY j.edad DESC;