import { and, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CheckoutOrderBody,
  CheckoutOrderResponse,
  CompleteFieldTaskBody,
  CompleteFieldTaskParams,
  CompleteFieldTaskResponse,
  GetDashboardSummaryResponse,
  GetDiagnosisParams,
  GetDiagnosisResponse,
  GetSprayWindowResponse,
  ListEscalationsResponse,
  ListFieldTasksResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  ListServicesResponse,
  ProcessIntakeBody,
  ProcessIntakeResponse,
  ReviewEscalationBody,
  ReviewEscalationParams,
  ReviewEscalationResponse,
  VerifyProductBatchBody,
  VerifyProductBatchResponse,
} from "@workspace/api-zod";
import {
  agriCasesTable,
  auditLogsTable,
  db,
  escalationsTable,
  fieldTasksTable,
  ordersTable,
} from "@workspace/db";
import { diagnoseCrop } from "../lib/cropDiagnosis";
import { getCurrentUserId, requireRole, requireSignedIn } from "../middlewares/auth";

const router: IRouter = Router();
const now = () => new Date();
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const products = [
  {
    id: "prod-bio-01",
    name: "TrichoGuard Bio-Fungicide",
    category: "Bio-pesticide",
    activeIngredient: "Trichoderma viride",
    compatibleCrops: ["tomato", "eggplant", "pepper"],
    targetProblems: ["fungal", "early blight", "leaf spot"],
    priceInr: 480,
    stock: 24,
    seller: "GreenField Inputs Co-op",
    sellerVerified: true,
    batch: {
      id: "batch-bio-2027",
      batchNumber: "TG-24-118",
      expiryDate: "2027-06-30",
      verified: true,
      recalled: false,
    },
    compatibilityScore: 0.94,
    safetyInstructions: [
      "Follow the product label directions.",
      "Wear gloves while handling.",
      "Do not apply during rain or high wind.",
    ],
    harvestIntervalDays: 0,
  },
  {
    id: "prod-compost-02",
    name: "SoilRise Organic Compost",
    category: "Organic compost",
    activeIngredient: "Composted farm residues",
    compatibleCrops: ["tomato", "rice", "wheat", "maize", "eggplant"],
    targetProblems: ["deficiency", "low nitrogen", "soil health"],
    priceInr: 320,
    stock: 41,
    seller: "GreenField Inputs Co-op",
    sellerVerified: true,
    batch: {
      id: "batch-compost-2027",
      batchNumber: "SR-08-260",
      expiryDate: "2027-11-30",
      verified: true,
      recalled: false,
    },
    compatibilityScore: 0.88,
    safetyInstructions: [
      "Apply according to the package label.",
      "Keep product dry and away from children.",
    ],
    harvestIntervalDays: 0,
  },
  {
    id: "prod-copper-03",
    name: "Copper Shield Fungicide",
    category: "Chemical fungicide",
    activeIngredient: "Copper oxychloride",
    compatibleCrops: ["tomato", "pepper"],
    targetProblems: ["fungal", "bacterial leaf spot"],
    priceInr: 690,
    stock: 9,
    seller: "AgriSure Licensed Store",
    sellerVerified: true,
    batch: {
      id: "batch-copper-expired",
      batchNumber: "CS-21-009",
      expiryDate: "2025-12-31",
      verified: true,
      recalled: false,
    },
    compatibilityScore: 0,
    safetyInstructions: [
      "Expired batch. This product is blocked from purchase.",
    ],
    harvestIntervalDays: 7,
  },
];

const services = [
  {
    id: "service-soil-lab",
    name: "District Soil Testing Lab",
    category: "Soil lab testing",
    description: "pH, N-P-K and micronutrient analysis with a crop-stage report.",
    rateInr: 250,
    unit: "per sample",
    verified: true,
    availability: "Next slot: Friday",
  },
  {
    id: "service-agronomist",
    name: "Agronomist Field Visit",
    category: "Agronomist consultation",
    description: "On-farm crop assessment and action plan from a local agronomist.",
    rateInr: 800,
    unit: "per visit",
    verified: true,
    availability: "Within 2 days",
  },
  {
    id: "service-drone",
    name: "Verified Drone Spraying",
    category: "Drone spraying",
    description: "Licensed operator; only scheduled after label and weather checks.",
    rateInr: 550,
    unit: "per acre",
    verified: true,
    availability: "Weather dependent",
  },
];

function dashboardSummary() {
  return GetDashboardSummaryResponse.parse({
    farmName: "Lakshmi's Tomato Plot",
    cropName: "Tomato",
    cropStage: "Flowering",
    acres: 1,
    openCases: 2,
    tasksDue: 2,
    mandiPrice: 2840,
    weatherAdvisory: "Rain likely within 12 hours — delay spraying.",
    recentActivity: [
      {
        id: "activity-soil",
        label: "Soil report reviewed",
        detail: "Low nitrogen noted for flowering-stage tomato.",
        createdAt: isoDate(now()),
        status: "reviewed",
      },
      {
        id: "activity-weather",
        label: "Spray window updated",
        detail: "Rain expected within the next 12 hours.",
        createdAt: isoDate(now()),
        status: "caution",
      },
    ],
  });
}

function sprayWindows() {
  const hours = Array.from({ length: 24 }, (_, index) => {
    const hour = (now().getUTCHours() + index) % 24;
    const rainChance = index < 12 ? (index < 4 ? 18 : 74) : index < 16 ? 42 : 18;
    const windKph = index < 6 ? 7 : index < 14 ? 17 : 8;
    const temperatureC = index < 8 ? 24 : index < 16 ? 32 : 26;
    const humidity = index < 8 ? 71 : index < 16 ? 54 : 66;
    const status =
      rainChance >= 60 || windKph > 15 || temperatureC > 35
        ? "avoid"
        : rainChance >= 35 || windKph > 12
          ? "caution"
          : "good";
    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      status,
      windKph,
      rainChance,
      humidity,
      temperatureC,
    };
  });
  return GetSprayWindowResponse.parse({
    district: "Nalgonda district (sample)",
    advisory:
      "Sample forecast: avoid spraying while rain is likely in the next 12 hours. Confirm local conditions before any field application.",
    hours,
  });
}

router.get("/dashboard/summary", (_req, res) => {
  res.json(dashboardSummary());
});

router.post("/intake/process", requireSignedIn, async (req, res): Promise<void> => {
  const parsed = ProcessIntakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const input = parsed.data;
  if (!input.consentToAnalyze) {
    res.status(400).json({ error: "Consent is required before analysis." });
    return;
  }

  let modelOutput;
  try {
    modelOutput = await diagnoseCrop(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("Unsupported or malformed image") ||
      message.includes("Image is too large")
    ) {
      res.status(400).json({ error: message });
      return;
    }
    req.log.error(
      { errorName: error instanceof Error ? error.name : "unknown" },
      "Crop diagnosis request failed",
    );
    res.status(502).json({
      error: "Diagnosis could not be completed. Please try again or contact an agronomist.",
    });
    return;
  }

  const userId = getCurrentUserId(req);
  const diagnosisId = crypto.randomUUID();
  const diagnosis = GetDiagnosisResponse.parse({
    id: diagnosisId,
    cropName: input.cropName,
    condition: modelOutput.primary_condition,
    category: modelOutput.condition_category,
    confidence: modelOutput.confidence_score,
    severity: modelOutput.severity_level,
    evidence: modelOutput.visual_evidence,
    differentials: modelOutput.differential_diagnoses.map((item) => ({
      condition: item.condition,
      probability: item.probability,
    })),
    suggestedObservations: modelOutput.suggested_observations,
    requiresOfficerReview: modelOutput.requires_officer_review,
    provenance: "AI-assisted · Gemini 2.5 Flash",
    safetyNote: modelOutput.requires_officer_review
      ? "Do not use a chemical intervention until a qualified agronomist has reviewed this case."
      : "This is an AI-assisted triage result, not a confirmed diagnosis. Verify the evidence in the field.",
  });

  const [savedCase] = await db
    .insert(agriCasesTable)
    .values({
      ownerUserId: userId,
      cropName: input.cropName,
      cropStage: input.cropStage,
      symptoms: input.symptoms,
      acres: String(input.acres),
      language: input.language,
      diagnosis,
    })
    .returning({ id: agriCasesTable.id });

  let escalationCreated = false;
  if (modelOutput.requires_officer_review) {
    const severe = ["severe", "critical"].includes(modelOutput.severity_level);
    const reason = severe
      ? "Severe symptoms require qualified agronomist review."
      : modelOutput.condition_category === "unknown"
        ? "The cause is unclear and requires qualified agronomist review."
        : "Confidence is below the 0.70 review threshold.";
    await db.insert(escalationsTable).values({
      ownerUserId: userId,
      diagnosisId,
      cropName: input.cropName,
      condition: modelOutput.primary_condition,
      confidence: String(modelOutput.confidence_score),
      severity: modelOutput.severity_level,
      status: "open",
      reason,
    });
    escalationCreated = true;
  }

  await db.insert(auditLogsTable).values({
    ownerUserId: userId,
    action: "intake.analyzed",
    payload: {
      consented: true,
      cropName: input.cropName,
      imageIncluded: Boolean(input.imageDataUrl),
      diagnosisId,
    },
  });

  req.log.info(
    { caseId: savedCase?.id, diagnosisId, escalated: escalationCreated },
    "Agricultural intake processed",
  );
  res.status(201).json(
    ProcessIntakeResponse.parse({
      observationId: savedCase?.id,
      diagnosis,
      escalationCreated,
    }),
  );
});

router.get("/diagnoses/:diagnosisId", requireSignedIn, async (req, res): Promise<void> => {
  const params = GetDiagnosisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [record] = await db
    .select({ diagnosis: agriCasesTable.diagnosis })
    .from(agriCasesTable)
    .where(
      and(
        eq(agriCasesTable.ownerUserId, getCurrentUserId(req)),
        sql`${agriCasesTable.diagnosis}->>'id' = ${params.data.diagnosisId}`,
      ),
    )
    .limit(1);
  if (!record) {
    res.status(404).json({ error: "Diagnosis not found." });
    return;
  }
  res.json(GetDiagnosisResponse.parse(record.diagnosis));
});

router.get("/marketplace/products", (req, res) => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const crop = params.data.crop?.toLowerCase();
  const problem = params.data.problem?.toLowerCase();
  const eligible = products.filter((product) => {
    const validBatch =
      product.batch.verified &&
      !product.batch.recalled &&
      product.batch.expiryDate >= isoDate(now()) &&
      product.sellerVerified &&
      product.stock > 0;
    const cropMatch =
      !crop || product.compatibleCrops.some((value) => value.toLowerCase() === crop);
    const problemMatch =
      !problem ||
      product.targetProblems.some((value) => value.toLowerCase().includes(problem));
    return validBatch && cropMatch && problemMatch;
  });
  const blockedProducts = products
    .filter((product) => !eligible.includes(product))
    .map((product) => ({
      name: product.name,
      reason:
        product.batch.expiryDate < isoDate(now())
          ? `Batch ${product.batch.batchNumber} expired on ${product.batch.expiryDate}.`
          : !product.sellerVerified
            ? "Seller verification is missing."
            : product.batch.recalled
              ? "This batch is recalled."
              : "Crop or problem compatibility could not be verified.",
    }));
  res.json(
    ListProductsResponse.parse({
      products: eligible,
      blockedProducts,
    }),
  );
});

router.post("/marketplace/verify-qr", (req, res) => {
  const parsed = VerifyProductBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const batch = products.find(
    (product) =>
      product.batch.batchNumber === parsed.data.qrPayload ||
      product.batch.id === parsed.data.qrPayload,
  );
  const authentic = Boolean(
    batch &&
      batch.sellerVerified &&
      batch.batch.verified &&
      !batch.batch.recalled &&
      batch.batch.expiryDate >= isoDate(now()),
  );
  res.json(
    VerifyProductBatchResponse.parse({
      authentic,
      message: authentic
        ? "This registered batch is verified and currently in date."
        : "Batch not found, expired, recalled, or linked to an unverified seller.",
      productName: batch?.name ?? "",
      batchNumber: batch?.batch.batchNumber ?? "",
      expiryDate: batch?.batch.expiryDate ?? "",
      sellerVerified: batch?.sellerVerified ?? false,
    }),
  );
});

router.post("/marketplace/checkout", requireSignedIn, async (req, res): Promise<void> => {
  const parsed = CheckoutOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  const [farmCase] = await db
    .select({
      diagnosis: agriCasesTable.diagnosis,
      ownerUserId: agriCasesTable.ownerUserId,
    })
    .from(agriCasesTable)
    .where(
      and(
        eq(agriCasesTable.ownerUserId, getCurrentUserId(req)),
        sql`${agriCasesTable.diagnosis}->>'id' = ${input.diagnosisId}`,
      ),
    )
    .limit(1);
  if (!farmCase) {
    res.status(422).json({ error: "A verified diagnosis is required for checkout." });
    return;
  }

  const diagnosis = GetDiagnosisResponse.parse(farmCase.diagnosis);
  if (diagnosis.requiresOfficerReview) {
    const [review] = await db
      .select({ status: escalationsTable.status })
      .from(escalationsTable)
      .where(eq(escalationsTable.diagnosisId, input.diagnosisId))
      .limit(1);
    if (review?.status !== "approved" && review?.status !== "modified") {
      res.status(422).json({
        error: "This case must be approved by an agronomist before any purchase.",
      });
      return;
    }
  }

  const selected: Array<{ productId: string; batchId: string; quantity: number }> = [];
  let subtotal = 0;
  for (const item of input.items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product || product.batch.id !== item.batchId) {
      res.status(422).json({ error: "Product or batch could not be verified." });
      return;
    }
    if (
      !product.sellerVerified ||
      !product.batch.verified ||
      product.batch.recalled ||
      product.batch.expiryDate < isoDate(now()) ||
      product.stock < item.quantity
    ) {
      res.status(422).json({
        error: `${product.name} is blocked because its seller, batch, expiry, or stock failed verification.`,
      });
      return;
    }
    if (
      !product.compatibleCrops.some(
        (crop) => crop.toLowerCase() === diagnosis.cropName.toLowerCase(),
      ) ||
      !product.targetProblems.some((problem) =>
        `${diagnosis.category} ${diagnosis.condition}`.toLowerCase().includes(problem.toLowerCase()),
      )
    ) {
      res.status(422).json({
        error: `${product.name} is not label-compatible with this crop diagnosis.`,
      });
      return;
    }
    if (product.category.toLowerCase().includes("chemical")) {
      const [review] = await db
        .select({ status: escalationsTable.status })
        .from(escalationsTable)
        .where(eq(escalationsTable.diagnosisId, input.diagnosisId))
        .limit(1);
      if (review?.status !== "approved" && review?.status !== "modified") {
        res.status(422).json({
          error: "Chemical inputs are blocked until an agronomist approves the case.",
        });
        return;
      }
    }
    subtotal += product.priceInr * item.quantity;
    selected.push(item);
  }

  const discountInr = input.fpoDiscount ? Math.round(subtotal * 0.1) : 0;
  const deliveryInr = 60;
  const totalInr = subtotal - discountInr + deliveryInr;
  const today = now();
  const followUpDate = new Date(today);
  followUpDate.setUTCDate(followUpDate.getUTCDate() + 7);
  const userId = getCurrentUserId(req);
  const receipt = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(ordersTable)
      .values({
        ownerUserId: userId,
        status: "placed",
        totalInr: String(totalInr),
        discountInr: String(discountInr),
        deliveryInr: String(deliveryInr),
        items: selected,
        shippingDistrict: input.shippingDistrict,
        pincode: input.pincode,
      })
      .returning({ id: ordersTable.id, createdAt: ordersTable.createdAt });
    const [task] = await tx
      .insert(fieldTasksTable)
      .values({
        ownerUserId: userId,
        title: "Check treatment response",
        description: "Upload a follow-up crop image and compare it with the original diagnosis.",
        dueDate: isoDate(followUpDate),
        type: "verification",
        diagnosisId: input.diagnosisId,
      })
      .returning({ id: fieldTasksTable.id });
    await tx.insert(auditLogsTable).values({
      ownerUserId: userId,
      action: "order.placed",
      payload: {
        consented: input.consentToPurchase,
        orderId: order?.id,
        totalInr,
        productCount: selected.length,
      },
    });
    return { order, task };
  });

  res.status(201).json(
    CheckoutOrderResponse.parse({
      id: receipt.order?.id,
      status: "placed",
      totalInr,
      discountInr,
      deliveryInr,
      createdAt: receipt.order?.createdAt.toISOString(),
      followUpTaskId: receipt.task?.id,
    }),
  );
});

router.get("/weather/spray-window", (req, res) => {
  res.json(GetSprayWindowResponse.parse(sprayWindows()));
});

router.get("/tasks", requireSignedIn, async (req, res): Promise<void> => {
  const tasks = await db
    .select()
    .from(fieldTasksTable)
    .where(eq(fieldTasksTable.ownerUserId, getCurrentUserId(req)))
    .orderBy(fieldTasksTable.dueDate);
  res.json(
    ListFieldTasksResponse.parse(
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        type: task.type,
        completed: task.completed,
        offlineCreated: task.offlineCreated,
        diagnosisId: task.diagnosisId,
      })),
    ),
  );
});

router.post(
  "/tasks/:taskId/complete",
  requireSignedIn,
  async (req, res): Promise<void> => {
    const params = CompleteFieldTaskParams.safeParse(req.params);
    const body = CompleteFieldTaskBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: params.error?.message ?? body.error?.message,
      });
      return;
    }
    const [task] = await db
      .update(fieldTasksTable)
      .set({ completed: true, offlineCreated: body.data.offlineCreated ?? false })
      .where(
        and(
          eq(fieldTasksTable.id, params.data.taskId),
          eq(fieldTasksTable.ownerUserId, getCurrentUserId(req)),
        ),
      )
      .returning();
    if (!task) {
      res.status(404).json({ error: "Field task not found." });
      return;
    }
    res.json(
      CompleteFieldTaskResponse.parse({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        type: task.type,
        completed: task.completed,
        offlineCreated: task.offlineCreated,
        diagnosisId: task.diagnosisId,
      }),
    );
  },
);

router.get("/escalations", requireRole("officer", "admin"), async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(escalationsTable)
    .where(eq(escalationsTable.status, "open"))
    .orderBy(escalationsTable.createdAt);
  res.json(
    ListEscalationsResponse.parse(
      rows.map((row) => ({
        id: row.id,
        diagnosisId: row.diagnosisId,
        cropName: row.cropName,
        condition: row.condition,
        confidence: Number(row.confidence),
        severity: row.severity,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        reason: row.reason,
        officerNotes: row.officerNotes,
      })),
    ),
  );
});

router.post(
  "/escalations/:escalationId/review",
  requireRole("officer", "admin"),
  async (req, res): Promise<void> => {
    const params = ReviewEscalationParams.safeParse(req.params);
    const body = ReviewEscalationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({
        error: params.error?.message ?? body.error?.message,
      });
      return;
    }
    const [updated] = await db
      .update(escalationsTable)
      .set({
        status: body.data.decision,
        officerNotes: body.data.notes,
        overrideCondition: body.data.overrideCondition ?? null,
        reviewedAt: now(),
      })
      .where(eq(escalationsTable.id, params.data.escalationId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Escalation not found." });
      return;
    }
    res.json(
      ReviewEscalationResponse.parse({
        id: updated.id,
        diagnosisId: updated.diagnosisId,
        cropName: updated.cropName,
        condition: updated.condition,
        confidence: Number(updated.confidence),
        severity: updated.severity,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        reason: updated.reason,
        officerNotes: updated.officerNotes,
      }),
    );
  },
);

router.get("/services", (_req, res) => {
  res.json(ListServicesResponse.parse(services));
});

export default router;
