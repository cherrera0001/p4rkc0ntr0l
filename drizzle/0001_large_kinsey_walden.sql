CREATE UNIQUE INDEX "sesion_vehiculo_activa_unica" ON "sesion_vehiculo" USING btree ("estacionamiento_id","patente") WHERE "sesion_vehiculo"."estado" = 'activa';--> statement-breakpoint
CREATE INDEX "sesion_vehiculo_por_estado" ON "sesion_vehiculo" USING btree ("estacionamiento_id","estado");--> statement-breakpoint
CREATE INDEX "sesion_vehiculo_por_salida" ON "sesion_vehiculo" USING btree ("estacionamiento_id","estado","salida_at");--> statement-breakpoint
ALTER TABLE "estacionamiento" ADD CONSTRAINT "capacidad_positiva" CHECK ("estacionamiento"."capacidad_total" > 0);--> statement-breakpoint
ALTER TABLE "sesion_vehiculo" ADD CONSTRAINT "tecleo_coherente" CHECK ("sesion_vehiculo"."tecleo_fin_at" >= "sesion_vehiculo"."tecleo_inicio_at");--> statement-breakpoint
ALTER TABLE "sesion_vehiculo" ADD CONSTRAINT "salida_posterior_a_entrada" CHECK ("sesion_vehiculo"."salida_at" IS NULL OR "sesion_vehiculo"."salida_at" >= "sesion_vehiculo"."entrada_at");--> statement-breakpoint
ALTER TABLE "sesion_vehiculo" ADD CONSTRAINT "monto_no_negativo" CHECK ("sesion_vehiculo"."monto_calculado" IS NULL OR "sesion_vehiculo"."monto_calculado" >= 0);--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "valor_hora_no_negativo" CHECK ("tarifa"."valor_hora" >= 0);--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "fraccion_positiva" CHECK ("tarifa"."fraccion_minutos" > 0);--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "monto_minimo_no_negativo" CHECK ("tarifa"."monto_minimo" >= 0);