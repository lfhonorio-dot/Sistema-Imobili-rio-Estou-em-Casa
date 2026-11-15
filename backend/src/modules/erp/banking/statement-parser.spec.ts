import * as ExcelJS from 'exceljs';
import { parseCsv, parseDate, parseMoney, parseOfx, parseXlsx } from './statement-parser';

// Fase 5 — importação de extrato: OFX, CSV (; ou ,) e Excel.

describe('statement-parser', () => {
  it('lê valores no formato brasileiro e internacional', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56);
    expect(parseMoney('-1.234,56')).toBe(-1234.56);
    expect(parseMoney('R$ 99,90')).toBe(99.9);
    expect(parseMoney('(150,00)')).toBe(-150);
    expect(parseMoney('1,234.56')).toBe(1234.56);
    expect(parseMoney('abc')).toBeNull();
  });

  it('lê datas dd/mm/aaaa e aaaa-mm-dd; recusa data impossível', () => {
    expect(parseDate('31/12/2026')?.toISOString().slice(0, 10)).toBe('2026-12-31');
    expect(parseDate('2026-12-31')?.toISOString().slice(0, 10)).toBe('2026-12-31');
    expect(parseDate('20261231')?.toISOString().slice(0, 10)).toBe('2026-12-31');
    expect(parseDate('31/02/2026')).toBeNull();
  });

  it('OFX', () => {
    const ofx = `<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105120000[-3:BRT]<TRNAMT>1500.00<FITID>abc1<MEMO>PIX RECEBIDO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261106<TRNAMT>-35,90<FITID>abc2<MEMO>TARIFA</STMTTRN>
</BANKTRANLIST></OFX>`;
    const r = parseOfx(ofx);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ externalId: 'abc1', amount: 1500, description: 'PIX RECEBIDO' });
    expect(r[1].amount).toBe(-35.9);
    expect(r[1].date.toISOString().slice(0, 10)).toBe('2026-11-06');
  });

  it('CSV com ; e coluna Valor; reimportar gera os mesmos ids (sem duplicar)', () => {
    const csv = 'Extrato conta 123\nData;Histórico;Valor\n05/11/2026;PIX recebido;1.500,00\n06/11/2026;Tarifa;-35,90\n06/11/2026;Tarifa;-35,90\n';
    const a = parseCsv(csv);
    const b = parseCsv(csv);
    expect(a.map((x) => x.amount)).toEqual([1500, -35.9, -35.9]);
    expect(a.map((x) => x.externalId)).toEqual(b.map((x) => x.externalId));
    expect(new Set(a.map((x) => x.externalId)).size).toBe(3); // linhas iguais não se fundem
  });

  it('CSV com , e colunas Crédito/Débito', () => {
    const r = parseCsv('date,description,credito,debito\n2026-11-05,"Cliente, Ltda",200.00,\n2026-11-06,Luz,,80.5\n');
    expect(r.map((x) => [x.description, x.amount])).toEqual([['Cliente, Ltda', 200], ['Luz', -80.5]]);
  });

  it('sem cabeçalho reconhecível dá erro claro', () => {
    expect(() => parseCsv('a;b;c\n1;2;3')).toThrow(/cabeçalho/);
  });

  it('planilha Excel', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Extrato');
    ws.addRow(['Data', 'Descrição', 'Valor']);
    ws.addRow([new Date(Date.UTC(2026, 10, 5)), 'Comissão', 12000]);
    ws.addRow(['06/11/2026', 'Aluguel escritório', '-2.500,00']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const r = await parseXlsx(buf);
    expect(r.map((x) => [x.date.toISOString().slice(0, 10), x.description, x.amount])).toEqual([
      ['2026-11-05', 'Comissão', 12000],
      ['2026-11-06', 'Aluguel escritório', -2500],
    ]);
  });
});
