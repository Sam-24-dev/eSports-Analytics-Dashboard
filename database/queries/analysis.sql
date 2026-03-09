-- ============================================================
-- Consultas analíticas de ejemplo para eSports Analytics
-- Motor: MySQL 8.0
-- ============================================================

-- 1. Total de equipos por país
SELECT p.nombre AS pais, COUNT(e.id) AS total_equipos
FROM paises p
LEFT JOIN equipos e ON e.pais_id = p.id
GROUP BY p.nombre
ORDER BY total_equipos DESC;

-- 2. Top jugadores por winrate (2024)
SELECT j.nombre, j.nacionalidad,
       ROUND(SUM(CASE WHEN pe.resultado = 'Victoria' THEN 1 ELSE 0 END) * 100.0
             / NULLIF(COUNT(pe.partido_id), 0), 1) AS winrate
FROM jugadores j
JOIN jugador_equipos je ON je.jugador_id = j.id
JOIN partido_equipos pe ON pe.equipo_id = je.equipo_id
JOIN partidos pa ON pa.id = pe.partido_id
WHERE YEAR(pa.fecha) = 2024
GROUP BY j.id, j.nombre, j.nacionalidad
HAVING COUNT(pe.partido_id) >= 3
ORDER BY winrate DESC
LIMIT 5;

-- 3. Premios totales por país
SELECT p.nombre AS pais,
       SUM(c.premio_total) AS premios_totales
FROM paises p
JOIN equipos e ON e.pais_id = p.id
JOIN competencia_equipos ce ON ce.equipo_id = e.id
JOIN competencias c ON c.id = ce.competencia_id
GROUP BY p.nombre
ORDER BY premios_totales DESC;

-- 4. Competencias con cantidad de equipos participantes
SELECT c.nombre, c.tipo, c.premio_total,
       COUNT(ce.equipo_id) AS equipos_participantes
FROM competencias c
LEFT JOIN competencia_equipos ce ON ce.competencia_id = c.id
GROUP BY c.id, c.nombre, c.tipo, c.premio_total
ORDER BY c.premio_total DESC;

-- 5. Jugador más veterano por equipo
SELECT e.nombre AS equipo, j.nombre AS jugador,
       TIMESTAMPDIFF(YEAR, j.fecha_nacimiento, CURDATE()) AS edad
FROM jugadores j
JOIN jugador_equipos je ON je.jugador_id = j.id
JOIN equipos e ON e.id = je.equipo_id
ORDER BY edad DESC;