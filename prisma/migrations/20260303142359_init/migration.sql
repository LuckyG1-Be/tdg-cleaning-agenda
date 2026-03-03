-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PRIVATE', 'BUSINESS');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "street" TEXT,
    "number" TEXT,
    "box" TEXT,
    "postal" TEXT,
    "city" TEXT,
    "country" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vat" TEXT,
    "type" "CustomerType",
    "notes" TEXT,
    "defaultRecurrence" TEXT,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentSeries" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "rrule" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "untilDate" TIMESTAMP(3),

    CONSTRAINT "AppointmentSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentException" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "seriesId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "AppointmentException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_lastName_idx" ON "Customer"("lastName");

-- CreateIndex
CREATE INDEX "Customer_company_idx" ON "Customer"("company");

-- CreateIndex
CREATE INDEX "Customer_city_idx" ON "Customer"("city");

-- CreateIndex
CREATE INDEX "AppointmentSeries_startDate_idx" ON "AppointmentSeries"("startDate");

-- CreateIndex
CREATE INDEX "AppointmentSeries_customerId_idx" ON "AppointmentSeries"("customerId");

-- CreateIndex
CREATE INDEX "AppointmentException_date_idx" ON "AppointmentException"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentException_seriesId_date_key" ON "AppointmentException"("seriesId", "date");

-- AddForeignKey
ALTER TABLE "AppointmentSeries" ADD CONSTRAINT "AppointmentSeries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentException" ADD CONSTRAINT "AppointmentException_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "AppointmentSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
