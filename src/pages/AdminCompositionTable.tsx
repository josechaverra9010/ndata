import { useState } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getLecheEnteraCompositionRows,
  getLecheSemidescremadaCompositionRows,
  getLecheDescremadaCompositionRows,
  getLecheEnteraAltasCaloriasCompositionRows,
  getSustitutosCompositionRows,
  getCarnesMagrasCompositionRows,
  getCarnesAltasLipidosCompositionRows,
  getLeguminosasAdultosCompositionRows,
  getLeguminosasNinosCompositionRows,
  getCerealesAdultosCompositionRows,
  getRaicesTuberculosPlatanosAdultosCompositionRows,
  getRaicesTuberculosPlatanosNinosCompositionRows,
  getCerealesNinosCompositionRows,
  getGrasasPoliinsaturadasCompositionRows,
  type CompositionTableRow,
} from "@/lib/foodNutrients";

function formatCell(value: number): string {
  if (value === 0) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function TableCellNum(value: number) {
  return <TableCell className="text-right tabular-nums">{formatCell(value)}</TableCell>;
}

function CompositionTable({ rows }: { rows: CompositionTableRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[180px]">Alimento</TableHead>
          <TableHead className="text-right w-16">g.</TableHead>
          <TableHead className="min-w-[200px]">Unidad de medida</TableHead>
          <TableHead className="text-right">Kcal.</TableHead>
          <TableHead className="text-right">Prot. g</TableHead>
          <TableHead className="text-right">GT. g</TableHead>
          <TableHead className="text-right">AGS. g</TableHead>
          <TableHead className="text-right">AGN. g</TableHead>
          <TableHead className="text-right">AGP. g</TableHead>
          <TableHead className="text-right">Col. mg</TableHead>
          <TableHead className="text-right">CHO. g</TableHead>
          <TableHead className="text-right">FDI. g</TableHead>
          <TableHead className="text-right">Ca. mg</TableHead>
          <TableHead className="text-right">P. mg</TableHead>
          <TableHead className="text-right">Fe. mg</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row: CompositionTableRow) => (
          <TableRow
            key={row.name}
            className={row.name === "Promedio" ? "bg-muted/50 font-medium" : ""}
          >
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.portion_grams != null ? row.portion_grams : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.unit_measure ?? "—"}
            </TableCell>
            {TableCellNum(row.kcal)}
            {TableCellNum(row.prot)}
            {TableCellNum(row.grasa)}
            {TableCellNum(row.gs)}
            {TableCellNum(row.gm)}
            {TableCellNum(row.gp)}
            {TableCellNum(row.col)}
            {TableCellNum(row.chos)}
            {TableCellNum(row.fd)}
            {TableCellNum(row.calcio)}
            {TableCellNum(row.p)}
            {TableCellNum(row.fe)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AdminCompositionTable() {
  const [activeTab, setActiveTab] = useState("entera");
  const rowsEntera = getLecheEnteraCompositionRows();
  const rowsSemidescremada = getLecheSemidescremadaCompositionRows();
  const rowsDescremada = getLecheDescremadaCompositionRows();
  const rowsAltasCalorias = getLecheEnteraAltasCaloriasCompositionRows();
  const rowsSustitutos = getSustitutosCompositionRows();
  const rowsCarnesMagras = getCarnesMagrasCompositionRows();
  const rowsCarnesAltasLipidos = getCarnesAltasLipidosCompositionRows();
  const rowsLeguminosasAdultos = getLeguminosasAdultosCompositionRows();
  const rowsLeguminosasNinos = getLeguminosasNinosCompositionRows();
  const rowsCerealesAdultos = getCerealesAdultosCompositionRows();
  const rowsRaicesTuberculosPlatanos = getRaicesTuberculosPlatanosAdultosCompositionRows();
  const rowsRaicesTuberculosPlatanosNinos = getRaicesTuberculosPlatanosNinosCompositionRows();
  const rowsCerealesNinos = getCerealesNinosCompositionRows();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tabla de composición de alimentos</h1>
          <p className="text-muted-foreground">
            Valores por porción según grupo
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="entera" className="text-xs sm:text-sm flex-1 min-w-0">Leche entera</TabsTrigger>
            <TabsTrigger value="semidescremada" className="text-xs sm:text-sm flex-1 min-w-0">Leche semidescremada</TabsTrigger>
            <TabsTrigger value="descremada" className="text-xs sm:text-sm flex-1 min-w-0">Leche descremada</TabsTrigger>
            <TabsTrigger value="altas-calorias" className="text-xs sm:text-sm flex-1 min-w-0">Entera alta cal. y azúcares</TabsTrigger>
            <TabsTrigger value="sustitutos" className="text-xs sm:text-sm flex-1 min-w-0">Sustitutos</TabsTrigger>
            <TabsTrigger value="carnes-magras" className="text-xs sm:text-sm flex-1 min-w-0">Carnes magras</TabsTrigger>
            <TabsTrigger value="carnes-altas-lipidos" className="text-xs sm:text-sm flex-1 min-w-0">Carnes altas en lípidos</TabsTrigger>
            <TabsTrigger value="leguminosas-adultos" className="text-xs sm:text-sm flex-1 min-w-0">Leguminosas adultos</TabsTrigger>
            <TabsTrigger value="leguminosas-ninos" className="text-xs sm:text-sm flex-1 min-w-0">Leguminosas niños</TabsTrigger>
            <TabsTrigger value="cereales-adultos" className="text-xs sm:text-sm flex-1 min-w-0">Cereales adultos</TabsTrigger>
            <TabsTrigger value="raices-tuberculos-platanos" className="text-xs sm:text-sm flex-1 min-w-0">Raíces, tubérculos y plátanos</TabsTrigger>
            <TabsTrigger value="raices-tuberculos-platanos-ninos" className="text-xs sm:text-sm flex-1 min-w-0">Raíces, tubérculos y plátanos (niños)</TabsTrigger>
            <TabsTrigger value="cereales-ninos" className="text-xs sm:text-sm flex-1 min-w-0">Cereales niños</TabsTrigger>
            <TabsTrigger value="grasas-poliinsaturadas" className="text-xs sm:text-sm flex-1 min-w-0">Grasas poliinsaturadas</TabsTrigger>
          </TabsList>
          <TabsContent value="entera" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Leche entera fresca y fermentada</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsEntera} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="semidescremada" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Leches semidescremadas frescas y fermentadas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsSemidescremada} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="descremada" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Leches descremadas frescas y fermentadas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsDescremada} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="altas-calorias" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Leches frescas y fermentadas enteras altas en calorías y azúcares</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsAltasCalorias} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="sustitutos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Sustitutos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsSustitutos} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="carnes-magras" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Carnes magras crudas y proteínas texturizadas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsCarnesMagras} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="carnes-altas-lipidos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Carnes crudas altas en lípidos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsCarnesAltasLipidos} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="leguminosas-adultos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Leguminosas adultos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsLeguminosasAdultos} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="leguminosas-ninos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Leguminosas niños y niñas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsLeguminosasNinos} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cereales-adultos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Cereales adultos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsCerealesAdultos} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="raices-tuberculos-platanos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Raíces, Tubérculos y Plátanos adultos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsRaicesTuberculosPlatanos} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="raices-tuberculos-platanos-ninos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Raíces, tubérculos y plátanos niños y niñas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsRaicesTuberculosPlatanosNinos} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="cereales-ninos" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Cereales niños y niñas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsCerealesNinos} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="grasas-poliinsaturadas" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Grasas poliinsaturadas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CompositionTable rows={rowsGrasasPoliinsaturadas} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
