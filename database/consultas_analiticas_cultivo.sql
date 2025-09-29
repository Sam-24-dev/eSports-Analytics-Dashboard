
-- CONSULTAS ANALÍTICAS AVANZADAS - SISTEMA CULTIVO DE ARROZ
-- Estas consultas demuestran habilidades de Data Analysis + SQL avanzado


USE Cultivo_Arroz;
-- 1. ANÁLISIS DE PRODUCTIVIDAD POR EMPLEADO
-- Ranking completo de empleados con métricas de eficiencia
SELECT 
    '=== ANÁLISIS DE PRODUCTIVIDAD POR EMPLEADO ===' as titulo;

SELECT 
    p.cedula,
    p.nombre,
    p.especialidad,
    p.salario_diario,
    COUNT(DISTINCT r.tarea_id) as total_tareas_asignadas,
    SUM(r.horas_trabajadas) as horas_totales_trabajadas,
    ROUND(AVG(r.horas_trabajadas), 2) as promedio_horas_por_tarea,
    COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) as tareas_completadas,
    ROUND(COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) / COUNT(DISTINCT r.tarea_id) * 100, 2) as porcentaje_exito,
    ROUND(SUM(CASE WHEN t.estado = 'Completada' THEN t.costo_real ELSE 0 END), 2) as costo_total_generado,
    ROUND(SUM(r.horas_trabajadas * p.salario_diario / 8), 2) as costo_mano_obra,
    ROUND(
        (SUM(CASE WHEN t.estado = 'Completada' THEN t.costo_real ELSE 0 END) - 
         SUM(r.horas_trabajadas * p.salario_diario / 8)) / 
         NULLIF(SUM(r.horas_trabajadas * p.salario_diario / 8), 0) * 100, 2
    ) as roi_empleado_porcentaje,
    RANK() OVER (
        ORDER BY 
            COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) / COUNT(DISTINCT r.tarea_id) DESC,
            SUM(CASE WHEN t.estado = 'Completada' THEN t.costo_real ELSE 0 END) / SUM(r.horas_trabajadas) DESC
    ) as ranking_eficiencia
FROM persona p
JOIN registro r ON p.cedula = r.empleado_id
JOIN tarea t ON r.tarea_id = t.id
WHERE p.estado = 'Activo'
GROUP BY p.cedula, p.nombre, p.especialidad, p.salario_diario
HAVING total_tareas_asignadas > 0
ORDER BY ranking_eficiencia ASC;

-- 2. ANÁLISIS FINANCIERO POR TIPO DE ACTIVIDAD
SELECT 
    '=== ANÁLISIS FINANCIERO POR TIPO DE ACTIVIDAD ===' as titulo;

WITH analisis_costos AS (
    SELECT 
        t.tipo,
        COUNT(*) as total_tareas,
        COUNT(CASE WHEN t.estado = 'Completada' THEN 1 END) as tareas_completadas,
        SUM(t.costo_estimado) as presupuesto_total,
        SUM(CASE WHEN t.estado = 'Completada' THEN t.costo_real ELSE 0 END) as costo_real_total,
        AVG(CASE WHEN t.estado = 'Completada' THEN t.costo_real END) as costo_promedio_real,
        STDDEV(CASE WHEN t.estado = 'Completada' THEN t.costo_real - t.costo_estimado END) as variabilidad_costos,
        SUM(CASE WHEN t.costo_real > t.costo_estimado AND t.estado = 'Completada' THEN 1 ELSE 0 END) as tareas_sobre_presupuesto,
        AVG(CASE WHEN t.estado = 'Completada' THEN TIMESTAMPDIFF(HOUR, t.inicio, t.fin) END) as duracion_promedio_horas
    FROM tarea t
    GROUP BY t.tipo
),
ingresos_cosecha AS (
    SELECT 
        'cosecha' as tipo,
        SUM(c.precio_venta_torvada * c.torvadas_obtenidas) as ingreso_total,
        AVG(c.precio_venta_torvada * c.torvadas_obtenidas) as ingreso_promedio
    FROM cosecha c
    JOIN tarea t ON c.tarea_id = t.id
    WHERE t.estado = 'Completada' AND c.precio_venta_torvada > 0
)
SELECT 
    ac.tipo,
    ac.total_tareas,
    ac.tareas_completadas,
    ROUND(ac.costo_real_total, 2) as inversion_total,
    ROUND(ac.costo_promedio_real, 2) as costo_promedio_por_tarea,
    ROUND(((ac.costo_real_total - (ac.presupuesto_total * ac.tareas_completadas / ac.total_tareas)) / 
           NULLIF(ac.presupuesto_total * ac.tareas_completadas / ac.total_tareas, 0)) * 100, 2) as desviacion_presupuestaria_pct,
    ROUND(ac.variabilidad_costos, 2) as desviacion_estandar_costos,
    ROUND((ac.tareas_sobre_presupuesto * 100.0 / ac.tareas_completadas), 1) as pct_tareas_sobre_presupuesto,
    ROUND(ac.duracion_promedio_horas, 1) as horas_promedio_por_tarea,
    ROUND(ac.costo_real_total / NULLIF(ac.duracion_promedio_horas * ac.tareas_completadas, 0), 2) as costo_por_hora,
    COALESCE(ROUND(ic.ingreso_total, 2), 0) as ingresos_generados,
    COALESCE(ROUND((ic.ingreso_total - ac.costo_real_total) / NULLIF(ac.costo_real_total, 0) * 100, 2), 0) as roi_porcentaje
FROM analisis_costos ac
LEFT JOIN ingresos_cosecha ic ON ac.tipo = ic.tipo
ORDER BY ac.costo_real_total DESC;

-- 3. ANÁLISIS TEMPORAL Y ESTACIONALIDAD (versión corregida)
SELECT '=== ANÁLISIS TEMPORAL Y ESTACIONALIDAD ===' as titulo;

WITH monthly AS (
  SELECT 
    YEAR(t.inicio) AS año,
    MONTH(t.inicio) AS mes,
    MONTHNAME(t.inicio) AS nombre_mes,
    t.tipo AS tipo_actividad,
    COUNT(*) AS tareas_iniciadas,
    SUM(CASE WHEN t.estado = 'Completada' THEN 1 ELSE 0 END) AS tareas_completadas,
    ROUND(AVG(CASE WHEN t.estado = 'Completada' THEN t.costo_real END), 2) AS costo_promedio,
    ROUND(AVG(CASE WHEN t.estado = 'Completada' THEN TIMESTAMPDIFF(HOUR, t.inicio, t.fin) END), 1) AS duracion_promedio_horas,
    -- métricas por tipo (agregadas por mes/tipo)
    ROUND(AVG(CASE WHEN t.tipo = 'cosecha' THEN c.torvadas_obtenidas END), 2) AS metrica_cosecha_prom,
    ROUND(AVG(CASE WHEN t.tipo = 'sembrado' THEN s.kilos_semilla END), 2) AS metrica_sembrado_prom,
    ROUND(AVG(CASE WHEN t.tipo = 'riego' THEN ri.agua_aplicada_litros END), 0) AS metrica_riego_prom,
    ROUND(AVG(CASE WHEN t.tipo = 'aplicacion' THEN af.cantidad_litros END), 2) AS metrica_aplicacion_prom
  FROM tarea t
  LEFT JOIN cosecha c ON t.id = c.tarea_id
  LEFT JOIN sembrado s ON t.id = s.tarea_id
  LEFT JOIN riego ri ON t.id = ri.tarea_id
  LEFT JOIN aplicacion_foliar af ON t.id = af.tarea_id
  WHERE t.inicio >= '2024-01-01'
  GROUP BY YEAR(t.inicio), MONTH(t.inicio), MONTHNAME(t.inicio), t.tipo
)
, with_lag AS (
  SELECT
    m.*,
    LAG(m.tareas_completadas) OVER (PARTITION BY m.tipo_actividad ORDER BY m.año, m.mes) AS tareas_mes_anterior
  FROM monthly m
)
SELECT
  año,
  mes,
  nombre_mes,
  tipo_actividad,
  tareas_iniciadas,
  tareas_completadas,
  ROUND(tareas_completadas / NULLIF(tareas_iniciadas,0) * 100, 1) AS porcentaje_completadas,
  costo_promedio,
  duracion_promedio_horas,
  -- elegir la métrica técnica según el tipo
  CASE tipo_actividad
    WHEN 'cosecha' THEN metrica_cosecha_prom
    WHEN 'sembrado' THEN metrica_sembrado_prom
    WHEN 'riego' THEN metrica_riego_prom
    WHEN 'aplicacion' THEN metrica_aplicacion_prom
    ELSE NULL
  END AS metrica_tecnica_promedio,
  tareas_mes_anterior,
  ROUND(
    ( (tareas_completadas - tareas_mes_anterior) * 100.0 ) / NULLIF(tareas_mes_anterior, 0),
    2
  ) AS variacion_pct_mes_anterior
FROM with_lag
ORDER BY año DESC, mes DESC, tipo_actividad;


-- 4. ANÁLISIS DE RENDIMIENTO POR ÁREA Y UBICACIÓN
SELECT 
    '=== ANÁLISIS DE RENDIMIENTO POR ÁREA Y UBICACIÓN ===' as titulo;

WITH rendimiento_areas AS (
    SELECT 
        a.id as area_id,
        a.nombre as area_nombre,
        a.hectareas,
        a.tipo_suelo,
        u.id as ubicacion_id,
        u.nombre as ubicacion_nombre,
        u.metros_cuadrados,
        u.coordenada_x,
        u.coordenada_y,
        -- Métricas operacionales
        COUNT(DISTINCT t.id) as total_tareas,
        COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) as tareas_completadas,
        ROUND(AVG(CASE WHEN t.estado = 'Completada' THEN TIMESTAMPDIFF(HOUR, t.inicio, t.fin) END), 1) as horas_promedio_por_tarea,
        -- Métricas financieras
        ROUND(SUM(CASE WHEN t.estado = 'Completada' THEN t.costo_real ELSE 0 END), 2) as inversion_total,
        ROUND(AVG(CASE WHEN t.estado = 'Completada' THEN t.costo_real END), 2) as costo_promedio_tarea,
        -- Métricas de productividad
        ROUND(SUM(CASE WHEN t.tipo = 'cosecha' AND t.estado = 'Completada' THEN c.torvadas_obtenidas ELSE 0 END), 2) as torvadas_totales,
        ROUND(SUM(CASE WHEN t.tipo = 'cosecha' AND t.estado = 'Completada' THEN c.kilos_equivalentes ELSE 0 END), 2) as kilos_totales,
        ROUND(AVG(CASE WHEN t.tipo = 'cosecha' AND t.estado = 'Completada' THEN c.rendimiento_hectarea END), 2) as rendimiento_promedio_por_hectarea,
        ROUND(SUM(CASE WHEN t.tipo = 'cosecha' AND t.estado = 'Completada' THEN c.precio_venta_torvada * c.torvadas_obtenidas ELSE 0 END), 2) as ingresos_totales
    FROM area a
    JOIN ubicacion u ON a.id = u.area_id AND u.activo = TRUE
    LEFT JOIN tarea t ON u.id = t.ubicacion_id
    LEFT JOIN cosecha c ON t.id = c.tarea_id
    GROUP BY a.id, a.nombre, a.hectareas, a.tipo_suelo, u.id, u.nombre, u.metros_cuadrados, u.coordenada_x, u.coordenada_y
    HAVING total_tareas > 0
)
SELECT 
    ra.area_nombre,
    ra.ubicacion_nombre,
    ra.hectareas,
    ra.tipo_suelo,
    ra.total_tareas,
    ra.tareas_completadas,
    ra.inversion_total,
    ra.ingresos_totales,
    ROUND(ra.ingresos_totales - ra.inversion_total, 2) as ganancia_neta,
    CASE 
        WHEN ra.inversion_total > 0 THEN ROUND((ra.ingresos_totales - ra.inversion_total) / ra.inversion_total * 100, 2)
        ELSE NULL 
    END as roi_porcentaje,
    ra.torvadas_totales,
    ra.rendimiento_promedio_por_hectarea,
    -- Rankings
    DENSE_RANK() OVER (ORDER BY ra.rendimiento_promedio_por_hectarea DESC) as ranking_productividad,
    DENSE_RANK() OVER (ORDER BY (ra.ingresos_totales - ra.inversion_total) DESC) as ranking_rentabilidad,
    -- Índices comparativos
    ROUND(CASE 
        WHEN ra.rendimiento_promedio_por_hectarea IS NOT NULL THEN 
            ra.rendimiento_promedio_por_hectarea / 
            NULLIF((SELECT AVG(rendimiento_promedio_por_hectarea) FROM rendimiento_areas WHERE rendimiento_promedio_por_hectarea IS NOT NULL), 0) * 100
        ELSE NULL 
    END, 1) as indice_productividad_vs_promedio
FROM rendimiento_areas ra
WHERE ra.tareas_completadas > 0
ORDER BY ra.rendimiento_promedio_por_hectarea DESC, (ra.ingresos_totales - ra.inversion_total) DESC;

-- 5. ANÁLISIS PREDICTIVO Y RECOMENDACIONES (versión con CTE + ROW_NUMBER)
SELECT '=== INSIGHTS Y RECOMENDACIONES ESTRATÉGICAS ===' as titulo;

WITH
mejor_empleado AS (
  SELECT 
    CONCAT(p.nombre, ' (', p.especialidad, ')') AS valor,
    CONCAT('Eficiencia: ', ROUND(COUNT(CASE WHEN t.estado = 'Completada' THEN 1 END) / COUNT(*) * 100, 1), '%') AS metrica,
    'Considerar para ascenso a supervisor o líder de equipo' AS recomendacion,
    ROW_NUMBER() OVER (
      ORDER BY (COUNT(CASE WHEN t.estado = 'Completada' THEN 1 END) / COUNT(*)) DESC,
               SUM(CASE WHEN t.estado = 'Completada' THEN t.costo_real ELSE 0 END) / NULLIF(SUM(r.horas_trabajadas),0) DESC
    ) AS rn
  FROM persona p
  JOIN registro r ON p.cedula = r.empleado_id
  JOIN tarea t ON r.tarea_id = t.id
  WHERE p.estado = 'Activo'
  GROUP BY p.cedula, p.nombre, p.especialidad
  HAVING COUNT(*) >= 2
),
area_mas_rentable AS (
  SELECT 
    a.nombre AS valor,
    CONCAT('ROI: ', ROUND((SUM(COALESCE(c.precio_venta_torvada * c.torvadas_obtenidas,0)) - SUM(t.costo_real)) / NULLIF(SUM(t.costo_real),0) * 100, 1), '%') AS metrica,
    'Expandir operaciones y replicar mejores prácticas' AS recomendacion,
    ROW_NUMBER() OVER (ORDER BY (SUM(COALESCE(c.precio_venta_torvada * c.torvadas_obtenidas,0)) - SUM(t.costo_real)) / NULLIF(SUM(t.costo_real),0) DESC) AS rn
  FROM area a
  JOIN tarea t ON a.id = t.area_id AND t.estado = 'Completada'
  LEFT JOIN cosecha c ON t.id = c.tarea_id
  GROUP BY a.id, a.nombre
  HAVING SUM(t.costo_real) > 0 AND SUM(COALESCE(c.precio_venta_torvada * c.torvadas_obtenidas,0)) > 0
),
actividad_mas_costosa AS (
  SELECT 
    UPPER(t.tipo) AS valor,
    CONCAT('Promedio: $', ROUND(AVG(t.costo_real), 2)) AS metrica,
    'Revisar procesos y buscar optimizaciones de costo' AS recomendacion,
    ROW_NUMBER() OVER (ORDER BY AVG(t.costo_real) DESC) AS rn
  FROM tarea t
  WHERE t.estado = 'Completada' AND t.costo_real > 0
  GROUP BY t.tipo
),
mejor_variedad AS (
  SELECT 
    COALESCE(s.variedad, 'Datos insuficientes') AS valor,
    CONCAT('Rendimiento: ', ROUND(AVG(c.rendimiento_hectarea), 2), ' kg/ha') AS metrica,
    'Priorizar esta variedad en futuras siembras' AS recomendacion,
    ROW_NUMBER() OVER (ORDER BY AVG(c.rendimiento_hectarea) DESC) AS rn
  FROM sembrado s
  JOIN tarea t ON s.tarea_id = t.id AND t.estado = 'Completada'
  JOIN tarea t2 ON t.area_id = t2.area_id AND t2.tipo = 'cosecha' AND t2.estado = 'Completada'
  JOIN cosecha c ON t2.id = c.tarea_id
  WHERE c.rendimiento_hectarea > 0
  GROUP BY s.variedad
  HAVING COUNT(*) >= 1
)
SELECT 'MEJOR EMPLEADO' AS categoria, valor, metrica, recomendacion FROM mejor_empleado WHERE rn = 1
UNION ALL
SELECT 'ÁREA MÁS RENTABLE' AS categoria, valor, metrica, recomendacion FROM area_mas_rentable WHERE rn = 1
UNION ALL
SELECT 'ACTIVIDAD MÁS COSTOSA' AS categoria, valor, metrica, recomendacion FROM actividad_mas_costosa WHERE rn = 1
UNION ALL
SELECT 'MEJOR VARIEDAD DE ARROZ' AS categoria, valor, metrica, recomendacion FROM mejor_variedad WHERE rn = 1;


-- 6. DASHBOARD EJECUTIVO - MÉTRICAS CLAVE (KPIs)
SELECT 
    '=== DASHBOARD EJECUTIVO - KPIs PRINCIPALES ===' as titulo;

-- KPIs Operacionales
SELECT 
    'OPERACIONES' as categoria,
    COUNT(DISTINCT p.cedula) as empleados_activos,
    COUNT(DISTINCT CASE WHEN p.especialidad != 'General' THEN p.cedula END) as empleados_especializados,
    COUNT(DISTINCT a.id) as areas_productivas,
    COUNT(DISTINCT u.id) as ubicaciones_activas,
    COUNT(DISTINCT t.id) as tareas_totales,
    COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) as tareas_completadas,
    ROUND(COUNT(DISTINCT CASE WHEN t.estado = 'Completada' THEN t.id END) / COUNT(DISTINCT t.id) * 100, 1) as porcentaje_cumplimiento
FROM persona p
CROSS JOIN area a
CROSS JOIN ubicacion u
CROSS JOIN tarea t
WHERE p.estado = 'Activo' AND u.activo = TRUE;

-- KPIs Financieros
SELECT 
    'FINANZAS' as categoria,
    ROUND(SUM(t.costo_real), 2) as inversion_total,
    ROUND(AVG(t.costo_real), 2) as costo_promedio_tarea,
    ROUND(SUM(CASE WHEN c.precio_venta_torvada > 0 THEN c.precio_venta_torvada * c.torvadas_obtenidas ELSE 0 END), 2) as ingresos_cosecha,
    ROUND(SUM(CASE WHEN c.precio_venta_torvada > 0 THEN c.precio_venta_torvada * c.torvadas_obtenidas ELSE 0 END) - SUM(t.costo_real), 2) as ganancia_neta,
    ROUND(((SUM(CASE WHEN c.precio_venta_torvada > 0 THEN c.precio_venta_torvada * c.torvadas_obtenidas ELSE 0 END) - SUM(t.costo_real)) / SUM(t.costo_real)) * 100, 2) as roi_general_porcentaje,
    ROUND(SUM(t.costo_real) / SUM(a.hectareas), 2) as inversion_por_hectarea
FROM tarea t
LEFT JOIN cosecha c ON t.id = c.tarea_id
LEFT JOIN area a ON t.area_id = a.id
WHERE t.estado = 'Completada';

-- KPIs de Productividad
SELECT 
    'PRODUCTIVIDAD' as categoria,
    ROUND(SUM(c.torvadas_obtenidas), 2) as torvadas_totales,
    ROUND(SUM(c.kilos_equivalentes), 2) as kilos_totales_producidos,
    ROUND(AVG(c.rendimiento_hectarea), 2) as rendimiento_promedio_hectarea,
    COUNT(DISTINCT c.tarea_id) as cosechas_realizadas,
    ROUND(AVG(c.humedad_porcentaje), 1) as humedad_promedio,
    COUNT(CASE WHEN c.calidad = 'Primera' THEN 1 END) as cosechas_calidad_primera,
    ROUND(COUNT(CASE WHEN c.calidad = 'Primera' THEN 1 END) / COUNT(*) * 100, 1) as porcentaje_calidad_primera
FROM cosecha c
JOIN tarea t ON c.tarea_id = t.id AND t.estado = 'Completada';

-- 7. VISTA CONSOLIDADA PARA EXPORTAR DATOS
SELECT 
    '=== PREPARANDO VISTA PARA EXPORTAR A CSV/EXCEL ===' as titulo;

-- Esta vista será útil para análisis externos en Python/R/Excel
CREATE OR REPLACE VIEW vista_datos_completos AS
SELECT 
    -- Identificadores y fechas
    t.id as tarea_id,
    DATE(t.inicio) as fecha_inicio,
    TIME(t.inicio) as hora_inicio,
    DATE(t.fin) as fecha_fin,
    TIME(t.fin) as hora_fin,
    TIMESTAMPDIFF(HOUR, t.inicio, t.fin) as duracion_horas,
    DAYNAME(t.inicio) as dia_semana,
    MONTH(t.inicio) as mes,
    YEAR(t.inicio) as año,
    
    -- Información de la tarea
    t.tipo as tipo_actividad,
    t.estado,
    t.prioridad,
    t.descripcion,
    t.costo_estimado,
    t.costo_real,
    t.costo_real - t.costo_estimado as desviacion_costo,
    CASE 
        WHEN t.costo_estimado > 0 THEN ROUND((t.costo_real - t.costo_estimado) / t.costo_estimado * 100, 2)
        ELSE NULL 
    END as desviacion_porcentual,
    
    -- Información geográfica
    a.id as area_id,
    a.nombre as area_nombre,
    a.hectareas,
    a.tipo_suelo,
    u.id as ubicacion_id,
    u.nombre as ubicacion_nombre,
    u.metros_cuadrados,
    ROUND(u.coordenada_x, 6) as coordenada_x,
    ROUND(u.coordenada_y, 6) as coordenada_y,
    
    -- Información del empleado
    p.cedula as empleado_cedula,
    p.nombre as empleado_nombre,
    p.especialidad as empleado_especialidad,
    p.salario_diario,
    r.horas_trabajadas,
    r.rol_en_tarea,
    ROUND(r.horas_trabajadas * p.salario_diario / 8, 2) as costo_mano_obra,
    
    -- Datos específicos por tipo de actividad
    CASE WHEN t.tipo = 'sembrado' THEN s.variedad END as variedad_arroz,
    CASE WHEN t.tipo = 'sembrado' THEN s.kilos_semilla END as kilos_semilla,
    CASE WHEN t.tipo = 'sembrado' THEN s.densidad_siembra END as densidad_siembra,
    CASE WHEN t.tipo = 'sembrado' THEN s.metodo_siembra END as metodo_siembra,
    
    CASE WHEN t.tipo = 'aplicacion' THEN af.producto END as producto_aplicado,
    CASE WHEN t.tipo = 'aplicacion' THEN af.tipo END as tipo_aplicacion,
    CASE WHEN t.tipo = 'aplicacion' THEN af.cantidad_litros END as litros_aplicados,
    CASE WHEN t.tipo = 'aplicacion' THEN af.costo_por_litro END as costo_por_litro,
    CASE WHEN t.tipo = 'aplicacion' THEN af.condicion_clima END as condiciones_clima,
    
    CASE WHEN t.tipo = 'riego' THEN ri.agua_aplicada_litros END as agua_aplicada_litros,
    CASE WHEN t.tipo = 'riego' THEN ri.tanques_gas_usados END as tanques_gas,
    CASE WHEN t.tipo = 'riego' THEN ri.costo_combustible END as costo_combustible,
    CASE WHEN t.tipo = 'riego' THEN ri.tiempo_riego_minutos END as minutos_riego,
    CASE WHEN t.tipo = 'riego' THEN ri.metodo_riego END as metodo_riego,
    
    CASE WHEN t.tipo = 'cosecha' THEN c.torvadas_obtenidas END as torvadas_cosechadas,
    CASE WHEN t.tipo = 'cosecha' THEN c.kilos_equivalentes END as kilos_cosechados,
    CASE WHEN t.tipo = 'cosecha' THEN c.rendimiento_hectarea END as rendimiento_por_hectarea,
    CASE WHEN t.tipo = 'cosecha' THEN c.calidad END as calidad_cosecha,
    CASE WHEN t.tipo = 'cosecha' THEN c.precio_venta_torvada END as precio_venta,
    CASE WHEN t.tipo = 'cosecha' THEN c.precio_venta_torvada * c.torvadas_obtenidas END as ingreso_bruto,
    CASE WHEN t.tipo = 'cosecha' THEN (c.precio_venta_torvada * c.torvadas_obtenidas) - t.costo_real END as ganancia_neta
    
FROM tarea t
JOIN area a ON t.area_id = a.id
JOIN ubicacion u ON t.ubicacion_id = u.id
JOIN registro r ON t.id = r.tarea_id
JOIN persona p ON r.empleado_id = p.cedula
LEFT JOIN sembrado s ON t.id = s.tarea_id
LEFT JOIN aplicacion_foliar af ON t.id = af.tarea_id
LEFT JOIN riego ri ON t.id = ri.tarea_id
LEFT JOIN cosecha c ON t.id = c.tarea_id;

-- Consulta final para mostrar muestra de datos
SELECT 
    'MUESTRA DE DATOS PARA EXPORTAR (primeros 10 registros):' as info;

SELECT * FROM vista_datos_completos 
ORDER BY fecha_inicio DESC, tarea_id DESC
LIMIT 10;

-- Estadísticas de la vista
SELECT 
    COUNT(*) as total_registros,
    COUNT(DISTINCT tarea_id) as tareas_unicas,
    COUNT(DISTINCT empleado_cedula) as empleados_involucrados,
    COUNT(DISTINCT area_id) as areas_utilizadas,
    MIN(fecha_inicio) as fecha_inicio_datos,
    MAX(COALESCE(fecha_fin, CURDATE())) as fecha_fin_datos
FROM vista_datos_completos;

