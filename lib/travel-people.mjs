import { TravelError, requiredText } from "./travel-core.mjs";
const DOCS = ["身份证", "护照", "港澳居民居住证", "台湾居民居住证", "台胞证", "回乡证", "户口簿", "出生证明", "军人证", "外国人永久居留身份证"];
function validDate(value, label) {
  const time = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new TravelError(`${label}日期格式无效`);
  return value;
}
export function validateTravelPassenger(p, departureDate, phone) {
  const name = requiredText(p.name, "乘机人姓名", 50), idType = requiredText(p.idType, "证件类型", 30), idNumber = requiredText(p.idNumber, "证件号码", 40);
  if (!DOCS.includes(idType)) throw new TravelError("请使用供应商支持的证件类型");
  const passenger = { name, idType, idNumber, mobile: phone, type: p.type === "儿童" ? "儿童" : "成人" };
  let birthday;
  if (idType === "身份证") {
    if (!/^\d{17}[\dXx]$/.test(idNumber)) throw new TravelError("身份证号码须为 18 位");
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checksum = "10X98765432"[[...idNumber.slice(0, 17)].reduce((sum, v, i) => sum + Number(v) * weights[i], 0) % 11];
    if (checksum !== idNumber[17].toUpperCase()) throw new TravelError("身份证校验位不正确，请核对证件号码");
    birthday = validDate(`${idNumber.slice(6, 10)}-${idNumber.slice(10, 12)}-${idNumber.slice(12, 14)}`, "出生");
  } else {
    birthday = validDate(p.birthday, "出生");
    passenger.birthday = birthday;
    passenger.psptEndDate = validDate(p.psptEndDate, "证件有效期");
    if (passenger.psptEndDate < departureDate) throw new TravelError("证件在出发前已过期");
    passenger.sex = Number(p.sex);
    if (![0, 1, 9].includes(passenger.sex)) throw new TravelError("请填写供应商要求的证件性别信息");
  }
  if (birthday > departureDate) throw new TravelError("乘机人出生日期不能晚于出发日期");
  let age = Number(departureDate.slice(0, 4)) - Number(birthday.slice(0, 4));
  if (departureDate.slice(5) < birthday.slice(5)) age--;
  if (age < 2) throw new TravelError("当前流程不支持婴儿票，请单独核实婴儿票证件与陪同规则");
  if ((age < 12) !== (passenger.type === "儿童")) throw new TravelError("乘客年龄与成人／儿童类型不一致，请按出发日期核对");
  return passenger;
}
