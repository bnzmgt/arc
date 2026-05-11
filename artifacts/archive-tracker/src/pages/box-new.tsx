import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateBox, getListBoxesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Package } from "lucide-react";
import { Link } from "wouter";

const MATERIAL_TYPES = [
  { value: "newspaper", label: "Newspaper" },
  { value: "maps", label: "Maps" },
  { value: "books", label: "Books" },
  { value: "magazine", label: "Magazine" },
  { value: "archives", label: "Archives" },
  { value: "heritage_items", label: "Heritage Items" },
] as const;

const PRIORITY_LEVELS = [
  { value: "P0", label: "P0 — Very Urgent" },
  { value: "P1", label: "P1 — Urgent" },
  { value: "P2", label: "P2 — Medium" },
  { value: "P3", label: "P3 — Low" },
] as const;

const CUSTODY_TYPES = [
  { value: "loan", label: "On Loan (Borrowed)" },
  { value: "owned", label: "Owned (Acquired)" },
] as const;

const schema = z.object({
  clientName: z.string().min(1, "Project name is required"),
  collectionsOwner: z.string().optional(),
  placeOfOrigin: z.string().optional(),
  materialTypes: z.array(z.enum(["newspaper", "maps", "books", "magazine", "archives", "heritage_items"])).min(1, "Select at least one material type"),
  priority: z.enum(["P0", "P1", "P2", "P3"], { required_error: "Priority is required" }),
  custodyType: z.enum(["loan", "owned"], { required_error: "Custody type is required" }),
  description: z.string().optional(),
  location: z.string().optional(),
  archiveYear: z.string().optional(),
  totalItems: z.coerce.number().int().min(0).optional().or(z.literal("")),
  cost: z.coerce.number().min(0).optional().or(z.literal("")),
  notes: z.string().optional(),
  photoLink: z.string().optional(),
  inDate: z.string().min(1, "Date received is required"),
  deadline: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function formatRupiah(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function BoxNewPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [displayCost, setDisplayCost] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: "",
      collectionsOwner: "",
      placeOfOrigin: "",
      materialTypes: [],
      priority: undefined,
      custodyType: undefined,
      description: "",
      location: "",
      archiveYear: "",
      totalItems: "",
      cost: "",
      notes: "",
      photoLink: "",
      inDate: new Date().toISOString().slice(0, 10),
      deadline: "",
    },
  });

  const createMutation = useCreateBox({
    mutation: {
      onSuccess: (box) => {
        queryClient.invalidateQueries({ queryKey: getListBoxesQueryKey() });
        toast({ title: `Box created: ${box.boxCode}` });
        navigate(`/boxes/${box.id}`);
      },
      onError: () => {
        toast({ title: "Failed to create box", variant: "destructive" });
      },
    },
  });

  function onSubmit(values: FormValues) {
    createMutation.mutate({
      data: {
        clientName: values.clientName,
        collectionsOwner: values.collectionsOwner || undefined,
        placeOfOrigin: values.placeOfOrigin || undefined,
        materialTypes: values.materialTypes,
        priority: values.priority || undefined,
        custodyType: values.custodyType || undefined,
        description: values.description || undefined,
        location: values.location || undefined,
        archiveYear: values.archiveYear || undefined,
        totalItems: values.totalItems !== "" ? Number(values.totalItems) : undefined,
        cost: values.cost !== "" ? Number(values.cost) : undefined,
        notes: values.notes || undefined,
        photoLink: values.photoLink || undefined,
        inDate: values.inDate ? new Date(values.inDate).toISOString() : undefined,
        deadline: values.deadline ? new Date(values.deadline).toISOString() : undefined,
      },
    });
  }

  return (
    <div className="space-y-5 max-w-2xl" data-testid="box-new-page">
      <div className="flex items-center gap-3">
        <Link href="/boxes">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">New Archive Item</h1>
          <p className="text-sm text-muted-foreground mt-0.5">The box code will be generated automatically based on custody type (OWN / LOA) and year</p>
        </div>
      </div>

      <Card className="border border-card-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package size={18} className="text-primary" />
            Item Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Project or department name" {...field} data-testid="input-client-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="collectionsOwner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collections Owner</FormLabel>
                      <FormControl>
                        <Input placeholder="Owner or custodian name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="placeOfOrigin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Place of Origin</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jakarta, Surabaya" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="materialTypes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material Type *</FormLabel>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {MATERIAL_TYPES.map(t => (
                        <div key={t.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`new-mt-${t.value}`}
                            checked={field.value?.includes(t.value)}
                            onCheckedChange={(checked) => {
                              const cur = field.value ?? [];
                              field.onChange(checked ? [...cur, t.value] : cur.filter(v => v !== t.value));
                            }}
                          />
                          <label htmlFor={`new-mt-${t.value}`} className="text-sm cursor-pointer">{t.label}</label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Level *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue placeholder="Select priority..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORITY_LEVELS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="custodyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custody Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-custody-type">
                            <SelectValue placeholder="Select custody type..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CUSTODY_TYPES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of contents" {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depot PTAD</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Lantai 1, Rak 3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price / Cost</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rp</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            className="pl-9"
                            value={displayCost}
                            onChange={(e) => {
                              const formatted = formatRupiah(e.target.value);
                              const raw = formatted.replace(/\./g, "");
                              setDisplayCost(formatted);
                              field.onChange(raw === "" ? "" : Number(raw));
                            }}
                            data-testid="input-cost"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Periode</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="archiveYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Periode</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1854-1930" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalItems"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Items</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="inDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Received *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deadline</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-deadline" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Special handling instructions, remarks..." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="photoLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo Proof Link</FormLabel>
                    <FormControl>
                      <Input placeholder="Paste Google Drive link..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
                <Link href="/boxes">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
