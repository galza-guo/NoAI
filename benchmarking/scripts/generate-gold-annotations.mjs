#!/usr/bin/env node
/**
 * NAIR-CN-v0.1 Gold Annotation Generator v2
 * 
 * Reads each markdown document, identifies sensitive spans with exact
 * zero-based character offsets, and outputs gold/*.gold.json files.
 * 
 * Usage: node benchmarking/scripts/generate-gold-annotations.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MARKDOWN_DIR = resolve(ROOT, 'suites/NAIR-CN-v0.1/markdown');
const GOLD_DIR = resolve(ROOT, 'suites/NAIR-CN-v0.1/gold');

mkdirSync(GOLD_DIR, { recursive: true });

function readDoc(filename) {
  return readFileSync(resolve(MARKDOWN_DIR, filename), 'utf-8');
}

function findAllLiteral(text, search) {
  const results = [];
  let idx = 0;
  while ((idx = text.indexOf(search, idx)) !== -1) {
    results.push({ start: idx, end: idx + search.length, text: search });
    idx += search.length;
  }
  return results;
}

function findAllRegex(text, pattern) {
  const results = [];
  const regex = new RegExp(pattern, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  return results;
}

function addAnnotations(existing, newAnnotations, type, category) {
  const map = new Map();
  for (const a of [...existing, ...newAnnotations.map(a => ({ ...a, type, category }))]) {
    const key = `${a.start}:${a.end}`;
    const existing = map.get(key);
    if (!existing || a.end - a.start > existing.end - existing.start) {
      map.set(key, a);
    }
  }
  return [...map.values()].sort((a, b) => a.start - b.start);
}

function validate(text, annotations) {
  const errors = [];
  for (const a of annotations) {
    const sliced = text.slice(a.start, a.end);
    if (sliced !== a.text) {
      errors.push(`MISMATCH at [${a.start},${a.end}]: expected "${a.text.slice(0,40)}", got "${sliced.slice(0,40)}"`);
    }
  }
  return errors;
}

/** Apply a list of literal patterns, each with a type/category */
function annotateLiterals(text, anns, patterns, type, category) {
  for (const p of patterns) {
    anns = addAnnotations(anns, findAllLiteral(text, p), type, category);
  }
  return anns;
}

// ============================================================
// DOC 001: Qichacha IPO Prospectus
// ============================================================
function annotateDoc001(text) {
  let anns = [];

  // --- REDACT: Organization names ---
  anns = annotateLiterals(text, anns, [
    '企查查科技股份有限公司', 'Qichacha Tec Co., Ltd.',
    '苏州朗动', '企查查有限', '企查查',
    '上海知彼', '北京知彼', '海南企查查', '新加坡企查查', '香港企查查',
    '浙江企查查', '苏州企查查', '苏州墨腾', '虎嗅科技', '北大英华', '无锡行动',
    '元禾纳芯', '万得信息', '险峰投资', '兴富新兴', '元禾鼎业', '兴富数智',
    '国方构筑', '中信投资', '荷花缘', '君安控股', '苏州知彼', '苏州知己',
    '苏州工业园区集成电路产业投资发展有限公司',
    '上海荷花缘企业管理中心（有限合伙）',
    '上海万兴信息科技有限公司',
    '苏州知彼信息科技中心（有限合伙）',
    '苏州知己网络科技中心（有限合伙）',
    '杭州险峰投资合伙企业（有限合伙）',
    '西藏险峰长晴创业投资管理有限公司',
    '达孜基石创业投资合伙企业（有限合伙）',
    '浙江普华天勤股权投资管理有限公司',
    '上海创业接力铂慧投资管理中心（有限合伙）',
    '绍兴曜灵股权投资合伙企业（有限合伙）',
    '上海铭武投资咨询事务所',
    '达孜合业企业管理有限公司',
    '上海嵩全投资管理有限公司',
    '西藏御珠企业管理有限公司',
    '北京险峰长青投资咨询有限公司',
    '兴富投资管理有限公司',
    '上海国方私募基金管理有限公司',
    '上海东洲资产评估有限公司',
    '普华永道中天会计师事务所（特殊普通合伙）',
    '新电信息科技（苏州）有限公司',
    '江苏欧索软件有限公司',
    '南京江琛自动化系统有限责任公司',
    '北大资产经营有限公司', '标找找',
  ], 'redact', 'organization_name');

  // --- REDACT: Person names ---
  anns = annotateLiterals(text, anns, [
    '陈德强', '白燕良', '杨京', '马群', '李素芹', '施阳',
    '尹尚文', '王金虎', '童刚', '朱正亮', '杜虎', '陈德志', '奚威',
    '倪传亮', '邱晶晶', '任何强', '王凯', '丁汉飞', '李俊', '刘龙辉',
    '陆紫华', '陈汝龙', '张全排', '倪小波', '何鑫', '范兆明', '晏疆', '王静',
    '巫建平', '刘建伟', '刘晓', '李翔', '曹春雷', '王铃', '吴大宝', '朱伟',
    '席鹏', '俞范磊', '周建军', '苏红', '赵帅', '李骁', '李晓伟', '李卫星',
    '黄秉霞', '陈学松', '闫东旭', '李斐', '曹彬', '叶秀清', '陈席', '孔林涛',
    '万春华', '徐立春', '张腾飞', '陆梦旦',
    '左凌烨', '刘峻', '雷量', '赵铭', '王辉', '陈金霞', '郑伟鹤', '邵亦文', '魏炜',
    '吴涛', '李岷', '孙捷',
  ], 'redact', 'person_name');

  // --- REDACT: Addresses ---
  anns = annotateLiterals(text, anns, [
    '中国（江苏）自由贸易试验区苏州片区苏州工业园区汇智街 8 号',
    '中国（江苏）自由贸易试验区苏州片区苏州工业园区汇智街8号',
    '浦明路1500号8层Z座',
    '浙江省杭州市上城区艮山支三路5号7幢342室',
    '汇智街8号1#研发总部大楼2楼M3室',
    '汇智街8号1#研发总部大楼2楼M2室',
  ], 'redact', 'address');

  // --- REDACT: Contact info ---
  anns = annotateLiterals(text, anns, [
    '215000', '400-928-2212', '0512-67620509',
    'www.qcc.com', 'ir@qcc.com',
  ], 'redact', 'contact_info');

  // --- REDACT: Certificate / report numbers ---
  anns = annotateLiterals(text, anns, [
    'GR202532002384',
    'GR202532002384 号',
  ], 'redact', 'certificate_number');

  // --- REDACT: ID numbers ---
  anns = annotateLiterals(text, anns, [
    '3303821985********', '3208021983********',
  ], 'redact', 'id_number');

  // --- REDACT: Report numbers via regex ---
  anns = addAnnotations(anns, findAllRegex(text, /东洲评报字\[2023\]第\s*\d+\s*号/g), 'redact', 'report_number');
  anns = addAnnotations(anns, findAllRegex(text, /普华永道中天特审字（\d{4}）第\s*\d+\s*号/g), 'redact', 'report_number');
  anns = addAnnotations(anns, findAllRegex(text, /容诚专字\[\d{4}\]\d+[A-Z]*\d*\s*号/g), 'redact', 'report_number');
  anns = addAnnotations(anns, findAllRegex(text, /容诚验字\[\d{4}\]\d+[A-Z]*\d*\s*号/g), 'redact', 'report_number');

  // --- REDACT: Amounts ---
  anns = annotateLiterals(text, anns, [
    '36,225.00万元', '50.0000', '5,319.1490', '36,000.0000', '36,225.0000',
    '54,919.29 万元', '53,232.49 万元',
    '1,541.04 万元', '658.05 万元', '400.64 万元',
    '6,900.00 万元', '2,100.00 万元', '200.00 万元',
    '1,000.00 新加坡元', '50,000.00 港元', '1,000.00 万元',
    '22.50 万元', '173.08 万元', '66.67 万元', '5.00 万元', '2,000.00 万元',
    '50,000.00万元', '100.00万元', '3,006.3836万元', '30,000.00万元',
  ], 'redact', 'amount');

  // --- REDACT: Dates ---
  anns = annotateLiterals(text, anns, [
    '2014年3月12日', '2023年4月30日', '2023年6月2日', '2023年7月6日',
  ], 'redact', 'date');

  // --- KEEP: Legal boilerplate ---
  anns = annotateLiterals(text, anns, [
    '招股说明书（申报稿）', '发行人基本情况', '控股股东、实际控制人',
    '截至本招股说明书签署日', '报告期各期', '本次发行前', '本次发行后',
    '中华人民共和国证券投资基金法', '私募投资基金监督管理暂行办法',
    '私募投资基金登记备案办法', '不存在特别表决权股份或类似安排',
    '不存在协议控制架构', '不存在贪污、贿赂、侵占财产',
  ], 'keep', 'legal_boilerplate');

  return anns;
}

// ============================================================
// DOC 002: Unitree Sponsor Letter
// ============================================================
function annotateDoc002(text) {
  let anns = [];

  // --- REDACT: Organization names ---
  anns = annotateLiterals(text, anns, [
    '宇树科技股份有限公司', '宇树科技',
    'Yushu Technology Co., Ltd.',
    'Unitree Technology Co., Ltd.',
    '中信证券股份有限公司', '中信证券',
    'Unitree',
  ], 'redact', 'organization_name');

  // Third-party companies mentioned in sponsor reps' track records
  anns = annotateLiterals(text, anns, [
    '人本股份有限公司', '南通江海电容器股份有限公司',
    '杭州天元宠物用品股份有限公司', '浙江一鸣食品股份有限公司',
    '宁波容百新能源科技股份有限公司', '深圳市安奈儿股份有限公司',
    '安正时尚集团股份有限公司', '广州白云电器设备股份有限公司', '喜临门家具股份有限公司',
    '金诚信矿业管理股份有限公司', '西藏华钰矿业股份有限公司',
    '北京安达维尔科技股份有限公司', '广联航空工业股份有限公司', '中国黄金集团黄金珠宝股份有限公司',
    '科德数控股份有限公司', '成都雷电微力科技股份有限公司',
    '龙芯中科技术股份有限公司', '南京高华科技股份有限公司',
    '成都佳驰电子科技股份有限公司', '中金黄金股份有限公司', '山东黄金股份有限公司',
    '杭州海康机器人股份有限公司', '中信金属股份有限公司',
    '北京华大九天科技股份有限公司', '爱美客技术发展股份有限公司', '重庆长安汽车股份有限公司',
    '第一拖拉机股份有限公司',
    '南京华东电子信息科技股份有限公司', '牡丹江恒丰纸业股份有限公司',
    '中信证券投资有限公司', '中信金石投资有限公司',
    '金石成长股权投资（杭州）合伙企业（有限合伙）',
    '特斯拉', 'Optimus Gen-3',
  ], 'redact', 'organization_name');

  // --- REDACT: Person names ---
  anns = annotateLiterals(text, anns, [
    '王兴兴', '傅风华', '高若阳', '陈熙颖', '刘梦迪',
    '金波', '赵旭亮', '朱伟铭', '俞瑶蓉', '林楷', '林鸿阳', '盛钰淋',
    '郭铖', '贾济舟', '刘一村', '石鑫', '王金石', '赵迎旭', '桑一帆',
    '张津源', '刘昊', '刘赜远', '胡娴', '覃星', '李融',
    '朱洁', '孙毅', '张佑君',
  ], 'redact', 'person_name');

  // --- REDACT: Contact info ---
  anns = annotateLiterals(text, anns, [
    '91330108MA27YJ5H56',
    '0571-58129599', '0571-85783757',
    '310000', 'ir@unitree.com', 'www.unitree.com',
  ], 'redact', 'contact_info');

  // Securities执业编号
  anns = annotateLiterals(text, anns, [
    'S1010717030001', 'S1010716040002', 'S1010720120025',
  ], 'redact', 'license_number');

  // --- REDACT: Addresses ---
  anns = annotateLiterals(text, anns, [
    '广东省深圳市福田区中心三路 8 号卓越时代广场（二期）北座',
    '浙江省杭州市滨江区西兴街道东流路 88 号 1 幢 306 室',
    '浙江省杭州市上城区解放东路 29 号迪凯银座大厦 17 层',
  ], 'redact', 'address');

  // --- REDACT: Dates ---
  anns = annotateLiterals(text, anns, [
    '2016 年 08 月 26 日', '2025 年 05 月 28 日',
    '二〇二六年五月',
  ], 'redact', 'date');

  // --- REDACT: Listing reference ---
  anns = annotateLiterals(text, anns, ['科创板'], 'redact', 'listing_market');

  // --- REDACT: Page reference codes ---
  anns = addAnnotations(anns, findAllRegex(text, /3-1-3-\d+/g), 'redact', 'page_reference');

  // --- REDACT: Financial amounts ---
  anns = addAnnotations(anns, findAllRegex(text, /[\d,]+\.\d{2}\s*万元/g), 'redact', 'amount');
  anns = addAnnotations(anns, findAllRegex(text, /[\d,]+\.\d{2}%/g), 'redact', 'percentage');
  anns = annotateLiterals(text, anns, [
    '36,401.7906 万元人民币', '36,401.7906 万股',
    '4,044.6434 万股',
    '不低于 40,446,434 股',
  ], 'redact', 'amount');

  // --- KEEP: Legal boilerplate ---
  anns = annotateLiterals(text, anns, [
    '保荐机构（主承销商）', '保荐人（主承销商）',
    '上市保荐书', '保荐书',
    '发行人符合', '本次发行符合',
    '保荐机构认为', '保荐机构承诺', '保荐人认为',
    '保荐人承诺事项', '保荐意见',
    '中华人民共和国公司法', '中华人民共和国证券法',
    '首次公开发行股票注册管理办法',
    '上海证券交易所科创板股票上市规则',
    '证券发行上市保荐业务管理办法',
    '保荐人尽职调查工作准则',
    '发行人不存在',
    '诚实守信，勤勉尽责',
  ], 'keep', 'legal_boilerplate');

  return anns;
}

// ============================================================
// DOC 003: Changxin Legal Opinion
// ============================================================
function annotateDoc003(text) {
  let anns = [];

  // --- REDACT: Organization names ---
  anns = annotateLiterals(text, anns, [
    '长鑫科技集团股份有限公司', '长鑫科技',
    '上海市锦天城律师事务所',
    '长鑫存储', '长鑫产品合肥', '长鑫新桥', '长鑫西安', '长鑫闵科', '长鑫集电',
    '长鑫存储技术有限公司',
    '国家集成电路产业投资基金二期股份有限公司', '大基金二期',
    '兆易创新科技集团股份有限公司', '兆易创新', '兆易创新集团',
    '阿里巴巴（中国）网络技术有限公司', '阿里网络',
    '建银国际（中国）有限公司', '建银国际（深圳）投资有限公司', '建银国际',
    '国寿投资保险资产管理有限公司', '国寿投资',
    '中国东方资产管理股份有限公司', '东方资管',
    '安徽交控招商产业投资基金（有限合伙）', '安徽交控',
    '中国国有企业结构调整基金股份有限公司', '国调基金',
    '安徽担保资产管理有限公司', '安徽担保资管',
    '合肥集鑫企业管理合伙企业（有限合伙）', '合肥集鑫',
    '安徽安元星亿达投资基金合伙企业（有限合伙）', '安元星亿达',
    '中华人民共和国财政部', '国开金融有限责任公司', '中国烟草总公司',
    '上海国盛（集团）有限公司', '武汉光谷金融控股集团有限公司',
    '浙江富浙集成电路产业发展有限公司', '成都天府国集投资有限公司',
    '重庆战略性新兴产业股权投资基金合伙企业（有限合伙）',
    '江苏疌泉集成电路产业投资有限公司', '北京亦庄国际投资发展有限公司',
    '北京国谊医院有限公司', '中移资本控股有限责任公司',
    '安徽省芯火集成电路产业投资合伙企业（有限合伙）',
    '安徽皖投安华现代产业投资合伙企业（有限合伙）',
    '广州产业投资基金管理有限公司', '福建省国资集成电路投资有限公司',
    '深圳市深超科技集成电路产业投资合伙企业（有限合伙）',
    '黄埔投资控股（广州）有限公司',
    '中国电信集团有限公司', '联通资本投资控股有限公司',
    '广西投资引导基金有限责任公司', '中电金投控股有限公司',
    '华芯投资管理有限责任公司', '北京建广私募基金管理有限公司',
    '上海矽启企业管理合伙企业（有限合伙）', '协鑫资本管理有限公司',
    '北京紫光通信科技集团有限公司', '福建三安集团有限公司',
    '安徽徽道招商私募基金管理有限公司',
    '合肥集鑫硕驰企业管理有限责任公司',
    '安徽安元投资基金管理有限公司',
    '北京清辉鑫电企业管理有限公司',
    '清辉景瑄（杭州）企业管理有限公司', '清辉景恒（北京）管理咨询有限公司',
    '清辉管理咨询有限公司', '清辉长鑫', 'TSINGHALO LIMITED', 'TSINGHALO PTE. LTD.',
    '北京创安微芯科技有限责任公司', '北京通美晶体技术股份有限公司',
    '香港集鑫有限公司', '安徽皖投资产管理有限公司',
    '安徽安凯汽车股份有限公司', '城市生命线产业发展集团（安徽）有限公司',
    '国元农业保险股份有限公司', '安徽省小额再贷款股份有限公司',
    '数字安徽有限责任公司', '长虹美菱股份有限公司',
    '马钢（合肥）钢铁有限责任公司', '合肥市生命健康产业发展有限公司',
    '合肥科技农村商业银行股份有限公司', '安徽安利材料科技股份有限公司',
    '合肥市创业投资引导基金有限公司', '合光光掩模科技（安徽）有限公司',
    '国家集成电路产业投资基金股份有限公司',
    '国家集成电路产业投资基金三期股份有限公司',
    '长江存储控股股份有限公司', '长江存储科技有限责任公司',
    '上海华力集成电路制造有限公司', '华虹半导体制造（无锡）有限公司',
    '武汉芯飞科技投资有限公司', '武汉芯腾科技投资有限公司',
    '华虹半导体（无锡）有限公司', '杭州富芯半导体有限公司',
    '中芯北方集成电路制造（北京）有限公司', '中芯京城集成电路制造（北京）有限公司',
    '江苏长电科技股份有限公司', '紫光展锐（上海）科技股份有限公司',
    '中水信通科技（武汉）有限公司', '上海芯展科技有限公司',
    '珠海市芯格善筑投资有限公司',
    '合肥经济技术开发区海恒科创控股集团有限公司',
    '合肥沛顿', '合肥鑫丰',
    '德勤', '德勤华永会计师事务所（特殊普通合伙）',
  ], 'redact', 'organization_name');

  // --- REDACT: Person names ---
  anns = annotateLiterals(text, anns, [
    '张新', '何卫', '曾昱', '张凤鸣', '郭祥玉', '蒋芳', '张伦超', '梁强',
    '彭红兵', '侯华伟', '朱一明', '赵纶', '郑锐', '方炜', '韦俊', '冯鹏熙', '李中亚',
  ], 'redact', 'person_name');

  // --- REDACT: Unified social credit codes ---
  anns = annotateLiterals(text, anns, [
    '91110000MA01N9JK2F', '91110108773369432Y', '91340100MA2NJYNM4Q',
    '91440300570046799W', '911100001020321266', '91110102MA008DDL0X',
    '91330100716105852F', '913400003487088943', '911100007109254543',
    '91340111MA2W0QEU5B', '91340111MA8LHU1Q45',
  ], 'redact', 'unified_social_credit_code');

  // --- REDACT: Certificate numbers ---
  anns = annotateLiterals(text, anns, [
    'GR202534004916', 'GR202561001668', 'GR202531003856', 'GR202534007148',
  ], 'redact', 'certificate_number');

  // --- REDACT: Pollution permit numbers ---
  anns = annotateLiterals(text, anns, [
    '91110302MA007QPT25001R', '91340100MA2MWUT60Q001W',
  ], 'redact', 'permit_number');

  // --- REDACT: Addresses ---
  anns = annotateLiterals(text, anns, [
    '北京市北京经济技术开发区景园北街 2 号 52 幢 7 层 701-6',
    '北京市海淀区丰豪东路 9 号院 8 号楼 1 至 5 层 101',
    '合肥市高新区望江西路 520 号皖通高速科技产业园区 11#研发楼 1 层',
    '深圳市前海深港合作区前湾一路鲤鱼门街一号前海深港合作区管理局综合办公楼 A 栋 201 室（入驻深圳市前海商务秘书有限公司）',
    '北京市朝阳区景华南街 5 号 17 层（14）1703 单元',
    '北京市西城区金融大街 9 号楼 6 层 601-02 单元',
    '浙江省杭州市滨江区网商路 699 号',
    '合肥市蜀山区怀宁路 288 号安徽担保大厦 18 楼',
    '北京市西城区阜成门内大街 410 号',
    '安徽省合肥市经济技术开发区合肥空港经济示范区玉兰花路东侧合肥空港动植物检验检疫进境指定口岸办公楼 110 室',
    '安徽省合肥市经济技术开发区习友路西、锦绣大道北南艳湖高科技研发基地（合肥清华科技城）水木园 12#楼 1102',
  ], 'redact', 'address');

  // --- REDACT: Dates ---
  anns = addAnnotations(anns, findAllRegex(text, /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/g), 'redact', 'date');

  // --- REDACT: Financial amounts ---
  anns = addAnnotations(anns, findAllRegex(text, /[\d,]+\.?\d*\s*万元/g), 'redact', 'amount');
  anns = addAnnotations(anns, findAllRegex(text, /[\d,]+\.?\d*\s*亿元/g), 'redact', 'amount');
  anns = addAnnotations(anns, findAllRegex(text, /[\d,]+\.?\d*\s*万美元/g), 'redact', 'amount');

  // --- KEEP: Legal boilerplate ---
  anns = annotateLiterals(text, anns, [
    '补充法律意见书', '法律意见书', '本所律师认为', '本所律师核查',
    '经本所律师查验', '经核查', '经本所律师核查',
    '符合《公司法》', '符合《证券法》', '符合《首发注册管理办法》',
    '首次公开发行股票注册管理办法',
    '上海证券交易所科创板股票上市规则',
    '发行人符合', '不存在控股股东', '不存在实际控制人',
    '审计报告（20251231）', '内控审计报告（20251231）',
    '招股说明书', '律师工作报告',
  ], 'keep', 'legal_boilerplate');

  return anns;
}

// ============================================================
// DOC 004: CSRC Shanghai Penalty
// ============================================================
function annotateDoc004(text) {
  let anns = [];

  // --- REDACT ---
  anns = annotateLiterals(text, anns, [
    '广东钜米私募证券投资基金管理有限公司', '广东钜米',
    '91440300349578294E',
    '沪〔2025〕56号',
    '广州市番禺区', '广州市白云区',
    '付某庆', '陈某蒲',
    '1984年出生', '1991年出生',
    '2024年10月9日', '2025年12月30日',
    '2,079,050.98元', '四十万元', '十二万元', '七十万元',
    '二十一万元', '十八万元', '一百一十万元', '三十三万元',
    '中国证券监督管理委员会上海监管局',
  ], 'redact', 'sensitive_info');

  // --- KEEP ---
  anns = annotateLiterals(text, anns, [
    '依据《私募投资基金监督管理条例》',
    '当事人未提出陈述、申辩意见，也未要求听证',
    '上述违法事实，有相关人员的询问笔录',
    '复议和诉讼期间，上述决定不停止执行',
    '本案现已调查、办理终结',
  ], 'keep', 'legal_boilerplate');

  return anns;
}

// ============================================================
// DOC 005: Huai'an Legal Services Contract
// ============================================================
function annotateDoc005(text) {
  let anns = [];

  // --- REDACT ---
  anns = annotateLiterals(text, anns, [
    '中共淮安经济技术开发区工委政法委员会',
    '北京盈科（淮安）律师事务所',
    'JSZC-320891-HAXH-G2025-0006',
    '人民币肆仟元整',
    '5 万元/年', '12 万元/年/包', '5000 元/件',
    '10 万元', '4 万元', '5 万元', '6 万元', '7 万元',
    '留学人员创业园管理办公室', '科教产业发展办公室',
    '财政与国有资产管理局', '园区生态环境分局',
    '钵池街道', '南马厂街道',
    '综合保税区管理办公室', '空港产业发展办公室',
    '住房和城乡建设局', '人力资源和社会保障局',
    '综合行政执法局', '土地储备中心', '自然资源分局',
    '徐杨街道', '枚乘街道',
    '淮安市仲裁委员会',
    '苏财购【2023】150 号', '财办库〔2021〕14 号',
    '2017 年江苏省律师服务收费试行标准的通知',
  ], 'redact', 'sensitive_info');

  // --- KEEP ---
  anns = annotateLiterals(text, anns, [
    '本合同所提供的服务及数量详见',
    '合同签订后 12 个月', '每半年支付一次',
    '本合同经甲、乙双方加盖电子签章后生效',
    '合同格式及条款', '招标文件和乙方的投标文件',
    '中标通知书', '甲乙双方商定的其他必要文件',
    '上述合同文件内容互为补充',
  ], 'keep', 'contract_boilerplate');

  return anns;
}

// ============================================================
// DOC 006: Mawei Procurement Contract
// ============================================================
function annotateDoc006(text) {
  let anns = [];

  // --- REDACT ---
  anns = annotateLiterals(text, anns, [
    '福州市马尾区教育局', '福建冠农新城科技有限公司',
    '[350105]FJSXH[TP]2025001',
    'CGXM-2025-350105-00153[2025]00135',
    '潘振强', '高建文', '叶铸用', '陈瑜',
    '福州市马尾区君竹路83号', '福州市马尾区建星路80号',
    '63190290', '13969720363',
    '350015',
    'mwjyjjyz@163.com', '17131834@qq.com',
    '113501050036281003', '91350105MA3458HX32',
    '中国建设银行股份有限公司福州马江支行',
    '35050161740100000023',
    '开户名称：福建冠农新城科技有限公司',
    '1,342,180.00', '1,258,000.00', '84,180.00',
    '壹佰叁拾肆万贰仟壹佰捌拾元整',
    '福州市马尾区人民法院',
    '2025年04月30日', '2025年05月10日', '2025-07-31', '2025年4月30日',
  ], 'redact', 'sensitive_info');

  // School names
  anns = annotateLiterals(text, anns, [
    '福州市金砂初级中学', '福州市快安学校', '福州市儒江小学',
    '福州亭江中心小学', '福州市亭江第二中心小学', '福州市东街小学',
    '福州市象洋小学', '福州市琅岐第二中心小学', '福州市金砂中心小学',
    '福州市云龙小学', '福州市海屿小学', '福州市海云初级中学',
    '福州市吴庄华侨小学',
  ], 'redact', 'organization_name');

  // --- KEEP ---
  anns = annotateLiterals(text, anns, [
    '政府采购货物买卖合同', '中华人民共和国政府采购法',
    '中华人民共和国民法典', '政府采购合同协议书',
    '政府采购合同通用条款', '政府采购合同专用条款',
    '商品包装政府采购需求标准', '快递包装政府采购需求标准',
    '节能产品政府采购品目清单', '环境标志产品政府采购品目清单',
    '本合同自', '合同生效', '合同份数', '合同订立时间', '合同订立地点',
  ], 'keep', 'contract_boilerplate');

  return anns;
}

// ============================================================
// DOC 007: BOC Asset Management Contract
// ============================================================
function annotateDoc007(text) {
  let anns = [];

  // --- REDACT: Plan/product name ---
  anns = annotateLiterals(text, anns, [
    '鼎锋成长 28 期资产管理计划',
    '鼎锋成长',
  ], 'redact', 'plan_name');

  // --- REDACT: Organization names ---
  anns = annotateLiterals(text, anns, [
    '中银国际期货有限责任公司', '中银国际期货',
    '中国银行股份有限公司上海市分行',
    '上海鼎锋资产管理有限公司',
    '国金道富投资服务有限公司',
    '中国银行上海市浦东分行营业一部',
  ], 'redact', 'organization_name');

  // --- REDACT: Person names ---
  anns = annotateLiterals(text, anns, [
    '翟增军', '殷泽', '赵蓉', '胡黎黎', '张超',
  ], 'redact', 'person_name');

  // --- REDACT: Contact info ---
  anns = annotateLiterals(text, anns, [
    '021-61088033', '021-58883676',
    '200122', '200120',
  ], 'redact', 'contact_info');

  // --- REDACT: Addresses ---
  anns = annotateLiterals(text, anns, [
    '中国（上海）自由贸易试验区世纪大道 1589 号 903-907 室',
    '上海市浦东新区世纪大道 1589 号长泰国际金融大厦 908-909 室',
    '上海市中山东一路 23 号',
    '上海市银城中路 200 号 14 层',
  ], 'redact', 'address');

  // --- REDACT: Bank accounts ---
  anns = annotateLiterals(text, anns, [
    '439069668894', '452059215520',
    '9061440019991001', '9060190019991001',
    '1001 1826 0900 0124 419',
    '4377 6692 9000',
  ], 'redact', 'bank_account');

  // --- REDACT: Fees and thresholds ---
  anns = annotateLiterals(text, anns, [
    '0.15%', '0.2%', '0.7%', '0.4%', '0.08%', '0.8700', '0.8000',
    '30,000,000', '500,000,000', '1,000,000',
  ], 'redact', 'financial_terms');

  // --- REDACT: Arbitration ---
  anns = annotateLiterals(text, anns, ['上海仲裁委员会'], 'redact', 'organization_name');

  // --- KEEP: Contract boilerplate ---
  anns = annotateLiterals(text, anns, [
    '资产管理合同', '资产管理计划', '资产管理人', '资产托管人',
    '投资顾问', '资产委托人', '资产管理业务风险揭示书',
    '资产合法性及投资者适当性承诺书',
    '中华人民共和国合同法', '中华人民共和国证券投资基金法',
    '私募投资基金监督管理暂行办法', '期货公司资产管理业务试点办法',
    '不可抗力', '争议解决', '法律适用', '合同编号',
    '投资有风险', '合格投资者',
  ], 'keep', 'contract_boilerplate');

  return anns;
}

// ============================================================
// DOC 008: Beijing Airport Annual Report
// ============================================================
function annotateDoc008(text) {
  let anns = [];

  // --- REDACT: Company names ---
  anns = annotateLiterals(text, anns, [
    '北京首都國際機場股份有限公司',
    '北京首都国际机场股份有限公司',
    '首都機場集團有限公司',
    '首都机场集团公司',
    '北京創聯民航技術有限公司',
    '北京首都機場商貿有限公司',
    '首都空港貴賓服務管理有限公司',
    '北京空港航空地面服務有限公司',
    '首都機場集團商務航空管理有限公司',
    '北京首都機場餐飲發展有限公司',
    '北京首都機場旅業有限公司',
    '首都機場集團傳媒有限公司',
    '北京首都機場航空安保有限公司',
    '北京首都機場動力能源有限公司',
    '北京首都機場節能技術服務有限公司',
    '北京博維航空設施管理有限公司',
    '北京首都機場物業管理有限公司',
    '北京首都機場航空服務有限公司',
    '北京民航機場巴士有限公司',
    '北京京瑞飯店管理有限責任公司',
    '北京中鵬飲料水有限公司',
    '首都機場集團科技管理有限公司',
    '首都機場集團財務有限公司',
    '內蒙古自治區民航機場集團有限責任公司',
    '首都機場集團設備運維管理有限公司',
    '中航鑫港擔保有限公司',
    '首都機場集團科技有限公司',
    '德勤 • 關黃陳方會計師行',
  ], 'redact', 'organization_name');

  // --- REDACT: Person names ---
  anns = annotateLiterals(text, anns, ['宋鵾'], 'redact', 'person_name');

  // --- REDACT: Contact info ---
  anns = annotateLiterals(text, anns, [
    '00694', '8610 6450 7700', 'ir@bcia.com.cn',
  ], 'redact', 'contact_info');

  // --- REDACT: Financial figures ---
  anns = addAnnotations(anns, findAllRegex(text, /[\d,]+\.?\d*\s*億元/g), 'redact', 'amount');
  anns = addAnnotations(anns, findAllRegex(text, /[\d,]+\.?\d*\s*百萬元/g), 'redact', 'amount');
  anns = addAnnotations(anns, findAllRegex(text, /[\d,]+\.?\d*\s*千元/g), 'redact', 'amount');

  // --- REDACT: Percentages ---
  anns = addAnnotations(anns, findAllRegex(text, /\d+\.\d+%/g), 'redact', 'percentage');

  // --- KEEP: Governance boilerplate ---
  anns = annotateLiterals(text, anns, [
    '年度報告', '年度报告', '董事會報告', '董事長報告',
    '管理層討論與分析', '公司管治報告', '獨立核數師報告',
    '財務概要', '公司簡介',
    '香港聯合交易所有限公司', '香港聯交所',
    '證券上市規則', '企業管治守則',
    '綜合損益表', '綜合財務狀況表', '現金流量表',
    '董事會', '股東週年大會', '核數師',
    '中華人民共和國', '外商投資股份有限公司',
  ], 'keep', 'governance_boilerplate');

  return anns;
}

// ============================================================
// Main
// ============================================================
const docs = [
  { docId: 'nair-cn-v0.1-doc-001', filename: 'nair-cn-doc-001-qichacha-ipo-prospectus.md', annotator: annotateDoc001 },
  { docId: 'nair-cn-v0.1-doc-002', filename: 'nair-cn-doc-002-unitree-sponsor-letter.md', annotator: annotateDoc002 },
  { docId: 'nair-cn-v0.1-doc-003', filename: 'nair-cn-doc-003-changxin-legal-opinion.md', annotator: annotateDoc003 },
  { docId: 'nair-cn-v0.1-doc-004', filename: 'nair-cn-doc-004-csrc-shanghai-penalty.md', annotator: annotateDoc004 },
  { docId: 'nair-cn-v0.1-doc-005', filename: 'nair-cn-doc-005-huaian-legal-services-contract.md', annotator: annotateDoc005 },
  { docId: 'nair-cn-v0.1-doc-006', filename: 'nair-cn-doc-006-mawei-procurement-contract.md', annotator: annotateDoc006 },
  { docId: 'nair-cn-v0.1-doc-007', filename: 'nair-cn-doc-007-boc-asset-management-contract.md', annotator: annotateDoc007 },
  { docId: 'nair-cn-v0.1-doc-008', filename: 'nair-cn-doc-008-beijing-airport-annual-report.md', annotator: annotateDoc008 },
];

let totalAnnotations = 0;
let totalErrors = 0;

for (const { docId, filename, annotator } of docs) {
  console.log(`\n=== ${docId} (${filename}) ===`);
  const text = readDoc(filename);
  console.log(`  Text length: ${text.length} chars`);

  const annotations = annotator(text);
  const errors = validate(text, annotations);

  if (errors.length > 0) {
    console.error(`  VALIDATION ERRORS: ${errors.length}`);
    for (const e of errors.slice(0, 10)) console.error(`    ${e}`);
    totalErrors += errors.length;
  } else {
    console.log(`  All ${annotations.length} annotations validated OK`);
  }

  const redactCount = annotations.filter(a => a.type === 'redact').length;
  const keepCount = annotations.filter(a => a.type === 'keep').length;
  console.log(`  redact: ${redactCount}, keep: ${keepCount}`);

  const output = {
    schemaVersion: '1.0.0',
    suiteId: 'NAIR-CN-v0.1',
    docId,
    annotatedAt: new Date().toISOString(),
    annotator: 'agent-gold-v2',
    totalChars: text.length,
    annotations: annotations.map(a => ({
      type: a.type,
      start: a.start,
      end: a.end,
      text: a.text,
      category: a.category,
    })),
  };

  writeFileSync(resolve(GOLD_DIR, `${docId}.gold.json`), JSON.stringify(output, null, 2), 'utf-8');
  totalAnnotations += annotations.length;
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total annotations: ${totalAnnotations}`);
console.log(`Total validation errors: ${totalErrors}`);
console.log(`Done.`);
