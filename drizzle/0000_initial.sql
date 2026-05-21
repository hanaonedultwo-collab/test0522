CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('admin', 'operator', 'customer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."order_status" AS ENUM('queued', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'generated', 'edited', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."llm_model" AS ENUM('gemini-3', 'gemini-2.5', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-5');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL,
  "name" varchar(80) NOT NULL,
  "role" "user_role" DEFAULT 'customer' NOT NULL,
  "credits" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "services" (
  "id" varchar(40) PRIMARY KEY NOT NULL,
  "name" varchar(80) NOT NULL,
  "logo_text" varchar(80) NOT NULL,
  "theme_color" varchar(20) DEFAULT '#7c3aed' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" varchar(40) PRIMARY KEY NOT NULL,
  "service_id" varchar(40) NOT NULL,
  "name" varchar(120) NOT NULL,
  "description" text,
  "credit_cost" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "template_designs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_id" varchar(40) NOT NULL,
  "product_id" varchar(40) NOT NULL,
  "html_template_path" varchar(240) NOT NULL,
  "css_template_path" varchar(240),
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid,
  "name" varchar(120) NOT NULL,
  "description" text,
  "theme" varchar(40) DEFAULT 'default' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sections" jsonb,
  "prompt_config" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "template_id" uuid,
  "service_id" varchar(40) NOT NULL,
  "product_id" varchar(40) NOT NULL,
  "status" "order_status" DEFAULT 'queued' NOT NULL,
  "llm_model" "llm_model" DEFAULT 'gpt-4.1' NOT NULL,
  "customer_name" varchar(80) NOT NULL,
  "customer_email" varchar(320) NOT NULL,
  "gender" varchar(10) NOT NULL,
  "calendar_type" varchar(10) DEFAULT 'solar' NOT NULL,
  "is_leap_month" boolean DEFAULT false NOT NULL,
  "birth_year" integer NOT NULL,
  "birth_month" integer NOT NULL,
  "birth_day" integer NOT NULL,
  "birth_hour" integer,
  "birth_minute" integer,
  "birth_time_unknown" boolean DEFAULT false NOT NULL,
  "longitude" integer DEFAULT 127 NOT NULL,
  "additional_question" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "charts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "source_calendar" varchar(10) NOT NULL,
  "saju_pillars" jsonb NOT NULL,
  "five_elements" jsonb NOT NULL,
  "ten_gods" jsonb NOT NULL,
  "raw_result" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "charts_order_id_unique" UNIQUE("order_id")
);

CREATE TABLE IF NOT EXISTS "analysis_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "template_section_key" varchar(100) NOT NULL,
  "title" varchar(140) NOT NULL,
  "status" "analysis_status" DEFAULT 'pending' NOT NULL,
  "llm_model" "llm_model" NOT NULL,
  "prompt_version" integer DEFAULT 1 NOT NULL,
  "prompt_text" text,
  "content" text,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "templates"
 ADD CONSTRAINT "templates_owner_user_id_users_id_fk"
 FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "products"
 ADD CONSTRAINT "products_service_id_services_id_fk"
 FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "template_designs"
 ADD CONSTRAINT "template_designs_service_id_services_id_fk"
 FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "template_designs"
 ADD CONSTRAINT "template_designs_product_id_products_id_fk"
 FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "orders"
 ADD CONSTRAINT "orders_user_id_users_id_fk"
 FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "orders"
 ADD CONSTRAINT "orders_template_id_templates_id_fk"
 FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "orders"
 ADD CONSTRAINT "orders_service_id_services_id_fk"
 FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "orders"
 ADD CONSTRAINT "orders_product_id_products_id_fk"
 FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "charts"
 ADD CONSTRAINT "charts_order_id_orders_id_fk"
 FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "analysis_sections"
 ADD CONSTRAINT "analysis_sections_order_id_orders_id_fk"
 FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;