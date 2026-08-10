CREATE TYPE "public"."estado_sesion" AS ENUM('activa', 'cerrada');--> statement-breakpoint
CREATE TYPE "public"."estado_sync" AS ENUM('local', 'sincronizada');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('operador', 'dueño');--> statement-breakpoint
CREATE TABLE "estacionamiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"capacidad_total" integer NOT NULL,
	"zona_horaria" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesion_vehiculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estacionamiento_id" uuid NOT NULL,
	"operador_id" uuid NOT NULL,
	"patente" text NOT NULL,
	"entrada_at" timestamp with time zone NOT NULL,
	"salida_at" timestamp with time zone,
	"monto_calculado" integer,
	"tecleo_inicio_at" timestamp with time zone NOT NULL,
	"tecleo_fin_at" timestamp with time zone NOT NULL,
	"estado" "estado_sesion" DEFAULT 'activa' NOT NULL,
	"sync_estado" "estado_sync" DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarifa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estacionamiento_id" uuid NOT NULL,
	"valor_hora" integer NOT NULL,
	"fraccion_minutos" integer NOT NULL,
	"monto_minimo" integer NOT NULL,
	"vigente_desde" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"rol" "rol_usuario" NOT NULL,
	"estacionamiento_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "sesion_vehiculo" ADD CONSTRAINT "sesion_vehiculo_estacionamiento_id_estacionamiento_id_fk" FOREIGN KEY ("estacionamiento_id") REFERENCES "public"."estacionamiento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesion_vehiculo" ADD CONSTRAINT "sesion_vehiculo_operador_id_usuario_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_estacionamiento_id_estacionamiento_id_fk" FOREIGN KEY ("estacionamiento_id") REFERENCES "public"."estacionamiento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_estacionamiento_id_estacionamiento_id_fk" FOREIGN KEY ("estacionamiento_id") REFERENCES "public"."estacionamiento"("id") ON DELETE no action ON UPDATE no action;