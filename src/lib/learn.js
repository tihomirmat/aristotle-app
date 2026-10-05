import { toast } from "sonner";
import { aiLearn } from "@/functions/aiLearn";

// Učenje v ozadju: ne blokira pošiljanja; ko AI zapiše novo pravilo, to pove.
export const learnInBackground = (payload, qc) => {
  aiLearn(payload).then((res) => {
    const d = res?.data ?? res;
    if (d?.learned?.length) toast.success(`AI se je naučil: »${d.learned[0]}«`, { description: "Pravila vidite v Nastavitve → Glas znamke." });
    else if (d?.reinforced?.length) toast(`Isto napako ste že popravili — pravilo »${d.reinforced[0]}« ima zdaj večjo težo.`);
    qc?.invalidateQueries({ queryKey: ["ai-lessons"] });
  }).catch(() => {});
};
