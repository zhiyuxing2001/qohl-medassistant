"use client"

import { Patient, Visit, api } from "@/lib/api"
import { IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"
import { useState } from "react"
import { Card, Empty, Field, SectionTitle, inputCls, textareaCls } from "./ui"

interface Props {
  patient: Patient | null
  visit: Visit | null
  onPatientUpdated: (p: Patient) => void
  onVisitUpdated: (v: Visit) => void
  onVisitDeleted: () => void
}

export function VisitTab({
  patient,
  visit,
  onPatientUpdated,
  onVisitUpdated,
  onVisitDeleted
}: Props) {
  const [pForm, setPForm] = useState<Record<string, string> | null>(null)
  const [vForm, setVForm] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)

  if (!patient) {
    return (
      <div className="p-4">
        <Empty text="请先在左侧选择或新建患者" />
      </div>
    )
  }

  const patientValues = pForm ?? {
    脱敏编号: patient.脱敏编号 || "",
    性别: patient.性别 || "",
    年龄: patient.年龄 != null ? String(patient.年龄) : "",
    体重: patient.体重 != null ? String(patient.体重) : "",
    过敏史: patient.过敏史 || "",
    既往史: patient.既往史 || "",
    家族史: patient.家族史 || "",
    备注: patient.备注 || ""
  }

  const savePatient = async () => {
    setSaving(true)
    try {
      const p = await api.put<Patient>(`/api/patients/${patient.patient_id}`, {
        脱敏编号: patientValues["脱敏编号"],
        性别: patientValues["性别"] || null,
        年龄: patientValues["年龄"] ? Number(patientValues["年龄"]) : null,
        体重: patientValues["体重"] ? Number(patientValues["体重"]) : null,
        过敏史: patientValues["过敏史"],
        既往史: patientValues["既往史"],
        家族史: patientValues["家族史"],
        备注: patientValues["备注"]
      })
      setPForm(null)
      toast.success("患者信息已保存")
      onPatientUpdated(p)
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const visitValues = vForm ?? {
    住院号: visit?.住院号 || "",
    入院日期: visit?.入院日期 || "",
    出院日期: visit?.出院日期 || "",
    状态: visit?.状态 || "住院中",
    主诉: visit?.主诉 || "",
    现病史: visit?.现病史 || "",
    体格检查: visit?.体格检查 || "",
    入院诊断: visit?.入院诊断 || "",
    出院诊断: visit?.出院诊断 || "",
    备注: visit?.备注 || ""
  }

  const saveVisit = async () => {
    if (!visit) return
    setSaving(true)
    try {
      const v = await api.put<Visit>(
        `/api/patients/${patient.patient_id}/visits/${visit.visit_id}`,
        {
          住院号: visitValues["住院号"],
          入院日期: visitValues["入院日期"] || null,
          出院日期: visitValues["出院日期"] || null,
          状态: visitValues["状态"],
          主诉: visitValues["主诉"],
          现病史: visitValues["现病史"],
          体格检查: visitValues["体格检查"],
          入院诊断: visitValues["入院诊断"],
          出院诊断: visitValues["出院诊断"],
          备注: visitValues["备注"]
        }
      )
      setVForm(null)
      toast.success("住院信息已保存")
      onVisitUpdated(v)
    } catch (e: any) {
      toast.error(e.message || "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const deleteVisit = async () => {
    if (!visit) return
    if (!confirm("确认删除该住院记录？此操作不可恢复。")) return
    try {
      await api.del(`/api/patients/${patient.patient_id}/visits/${visit.visit_id}`)
      toast.success("已删除住院记录")
      onVisitDeleted()
    } catch (e: any) {
      toast.error(e.message || "删除失败")
    }
  }

  const setP = (k: string, v: string) =>
    setPForm({ ...patientValues, [k]: v })

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <Card>
        <SectionTitle>患者信息</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="脱敏编号">
            <input
              className={inputCls}
              value={patientValues["脱敏编号"]}
              onChange={e => setP("脱敏编号", e.target.value)}
            />
          </Field>
          <Field label="性别">
            <input
              className={inputCls}
              value={patientValues["性别"]}
              onChange={e => setP("性别", e.target.value)}
            />
          </Field>
          <Field label="年龄">
            <input
              className={inputCls}
              type="number"
              value={patientValues["年龄"]}
              onChange={e => setP("年龄", e.target.value)}
            />
          </Field>
          <Field label="体重(kg)">
            <input
              className={inputCls}
              type="number"
              value={patientValues["体重"]}
              onChange={e => setP("体重", e.target.value)}
            />
          </Field>
          <Field label="过敏史" className="col-span-2">
            <input
              className={inputCls}
              value={patientValues["过敏史"]}
              onChange={e => setP("过敏史", e.target.value)}
            />
          </Field>
          <Field label="既往史" className="col-span-2">
            <textarea
              className={textareaCls}
              value={patientValues["既往史"]}
              onChange={e => setP("既往史", e.target.value)}
            />
          </Field>
          <Field label="家族史" className="col-span-2">
            <textarea
              className={textareaCls}
              value={patientValues["家族史"]}
              onChange={e => setP("家族史", e.target.value)}
            />
          </Field>
          <Field label="备注" className="col-span-2">
            <textarea
              className={textareaCls}
              value={patientValues["备注"]}
              onChange={e => setP("备注", e.target.value)}
            />
          </Field>
        </div>
        <button
          className="bg-primary text-primary-foreground mt-3 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={saving}
          onClick={savePatient}
        >
          保存患者信息
        </button>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle className="mb-0">住院信息</SectionTitle>
          {visit && (
            <button
              className="text-destructive hover:opacity-70"
              onClick={deleteVisit}
              title="删除住院"
            >
              <IconTrash size={16} />
            </button>
          )}
        </div>

        {!visit ? (
          <Empty text="请选择或新建住院记录" />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="住院号">
              <input
                className={inputCls}
                value={visitValues["住院号"]}
                onChange={e =>
                  setVForm({ ...visitValues, 住院号: e.target.value })
                }
              />
            </Field>
            <Field label="状态">
              <select
                className={inputCls}
                value={visitValues["状态"]}
                onChange={e =>
                  setVForm({ ...visitValues, 状态: e.target.value })
                }
              >
                <option>住院中</option>
                <option>已出院</option>
              </select>
            </Field>
            <Field label="入院日期">
              <input
                className={inputCls}
                type="date"
                value={visitValues["入院日期"]}
                onChange={e =>
                  setVForm({ ...visitValues, 入院日期: e.target.value })
                }
              />
            </Field>
            <Field label="出院日期">
              <input
                className={inputCls}
                type="date"
                value={visitValues["出院日期"]}
                onChange={e =>
                  setVForm({ ...visitValues, 出院日期: e.target.value })
                }
              />
            </Field>
            <Field label="主诉" className="col-span-2">
              <textarea
                className={textareaCls}
                value={visitValues["主诉"]}
                onChange={e =>
                  setVForm({ ...visitValues, 主诉: e.target.value })
                }
              />
            </Field>
            <Field label="现病史" className="col-span-2">
              <textarea
                className={textareaCls}
                value={visitValues["现病史"]}
                onChange={e =>
                  setVForm({ ...visitValues, 现病史: e.target.value })
                }
              />
            </Field>
            <Field label="体格检查" className="col-span-2">
              <textarea
                className={textareaCls}
                value={visitValues["体格检查"]}
                onChange={e =>
                  setVForm({ ...visitValues, 体格检查: e.target.value })
                }
              />
            </Field>
            <Field label="入院诊断">
              <textarea
                className={textareaCls}
                value={visitValues["入院诊断"]}
                onChange={e =>
                  setVForm({ ...visitValues, 入院诊断: e.target.value })
                }
              />
            </Field>
            <Field label="出院诊断">
              <textarea
                className={textareaCls}
                value={visitValues["出院诊断"]}
                onChange={e =>
                  setVForm({ ...visitValues, 出院诊断: e.target.value })
                }
              />
            </Field>
            <Field label="备注" className="col-span-2">
              <textarea
                className={textareaCls}
                value={visitValues["备注"]}
                onChange={e =>
                  setVForm({ ...visitValues, 备注: e.target.value })
                }
              />
            </Field>

            <button
              className="bg-primary text-primary-foreground col-span-2 mt-1 rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={saving}
              onClick={saveVisit}
            >
              保存住院信息
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}
