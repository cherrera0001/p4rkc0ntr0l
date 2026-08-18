ALTER TYPE "public"."rol_usuario" ADD VALUE 'plataforma';--> statement-breakpoint
ALTER TABLE "usuario" ALTER COLUMN "estacionamiento_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "pertenencia_por_rol" CHECK (("usuario"."rol"::text = 'plataforma' AND "usuario"."estacionamiento_id" IS NULL)
        OR ("usuario"."rol"::text <> 'plataforma' AND "usuario"."estacionamiento_id" IS NOT NULL));