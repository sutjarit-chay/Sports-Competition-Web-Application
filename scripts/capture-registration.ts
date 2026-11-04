import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { initialState } from "../lib/domain";

async function capture() {
  const output=resolve("docs/registration-review"); await mkdir(output,{recursive:true});
  const browser=await chromium.launch({channel:process.platform==="darwin" ? "chrome":undefined,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
  const state=initialState();
  state.athletes=[{id:"legacy-demo",name:"นักกีฬาสาธิตเดิม",school_id:"1",sport:"ฟุตบอล",gender:"ชาย",division:"ประถม",bib:"101"}];
  const reports=[];
  for(const [name,width,height] of [["desktop",1440,1100],["mobile",390,844],["tablet",820,1180]] as const) {
    const context=await browser.newContext({viewport:{width,height}});
    await context.addInitScript(data=>localStorage.setItem("kosamphi-demo-v1",JSON.stringify(data)),state);
    const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(process.env.DESIGN_PREVIEW_URL||"http://127.0.0.1:3100");
    await page.getByRole("button",{name:"นักกีฬา",exact:true}).click();
    await page.evaluate(()=>document.fonts.ready);
    await page.getByLabel("ชื่อ–นามสกุล",{exact:true}).fill("นักกีฬาสาธิตตัวจริง");
    await page.getByRole("button",{name:"+ เพิ่มนักกีฬา"}).click();
    await page.getByRole("cell",{name:"นักกีฬาสาธิตตัวจริง",exact:true}).waitFor();
    await page.screenshot({path:`${output}/${name}-registration.png`,fullPage:true});
    await page.locator(".roster-panel").screenshot({path:`${output}/${name}-form.png`});
    if(name==="desktop") {await page.emulateMedia({media:"print"});await page.pdf({path:`${output}/registration-demo.pdf`,landscape:true,format:"A4"});await page.emulateMedia({media:"screen"});}
    await page.getByLabel("ประเภทการแข่งขัน",{exact:true}).selectOption("athletics-individual");
    await page.getByText("ตั้งค่าจำนวนสำรองและโควตา (ผู้ดูแลระบบ)",{exact:true}).click();
    await page.getByLabel("โควตา วิ่ง 60 เมตร",{exact:true}).fill("1");
    await page.getByLabel("โควตา วิ่ง 100 เมตร",{exact:true}).fill("2");
    await page.getByRole("button",{name:"บันทึกกติกาการสมัคร"}).click();
    await page.getByLabel("ชื่อ–นามสกุล",{exact:true}).fill("นักวิ่งสาธิตหลายรายการ");
    await page.getByRole("checkbox",{name:/วิ่ง 60 เมตร/}).check();await page.getByRole("checkbox",{name:/วิ่ง 100 เมตร/}).check();
    await page.getByRole("button",{name:"+ เพิ่มนักกีฬา"}).click();
    await page.getByRole("cell",{name:"นักวิ่งสาธิตหลายรายการ",exact:true}).waitFor();
    await page.locator(".roster-panel").screenshot({path:`${output}/${name}-athletics.png`});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    reports.push({name,width,errors,overflow});
    if(overflow||errors.length)throw Error(JSON.stringify(reports));
    await context.close();
  }
  await browser.close();console.log(JSON.stringify(reports,null,2));
}
capture().catch(error=>{console.error(error);process.exitCode=1;});
