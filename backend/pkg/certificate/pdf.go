package certificate

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"

	"github.com/jung-kurt/gofpdf"
)

// FontPaths — порядок поиска шрифта с поддержкой кириллицы (UTF-8).
var FontPaths = []string{
	"fonts/DejaVuSans.ttf",
	"backend/fonts/DejaVuSans.ttf",
}

func findFontPath() (string, error) {
	if p := os.Getenv("CERT_FONT_PATH"); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	wd, _ := os.Getwd()
	for _, rel := range FontPaths {
		p := filepath.Join(wd, rel)
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
		// без wd (относительно текущей директории)
		if _, err := os.Stat(rel); err == nil {
			return rel, nil
		}
	}
	return "", fmt.Errorf("шрифт для PDF не найден: поместите DejaVuSans.ttf в fonts/ или задайте CERT_FONT_PATH")
}

// Generate создаёт PDF-сертификат: курс title, дата date, имя слушателя studentName.
func Generate(title, date, studentName string) ([]byte, error) {
	fontPath, err := findFontPath()
	if err != nil {
		return nil, err
	}

	fontBytes, err := os.ReadFile(fontPath)
	if err != nil {
		return nil, fmt.Errorf("чтение шрифта: %w", err)
	}
	fontCopy := make([]byte, len(fontBytes))
	copy(fontCopy, fontBytes)

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(20, 20, 20)
	pdf.SetAutoPageBreak(true, 15)
	pdf.AddPage()

	// Один шрифт (regular), стиль "B" не используем — иначе PDF может быть битым
	pdf.AddUTF8FontFromBytes("DejaVu", "", fontCopy)
	if pdf.Err() {
		return nil, fmt.Errorf("добавление шрифта: %w", pdf.Error())
	}
	pdf.SetFont("DejaVu", "", 11)

	// Заголовок (крупнее, только regular — без bold)
	pdf.SetFont("DejaVu", "", 18)
	pdf.CellFormat(0, 12, "Сертификат о прохождении курса", "", 1, "C", false, 0, "")
	pdf.Ln(1)
	pdf.SetFont("DejaVu", "", 10)
	pdf.SetTextColor(100, 100, 100)
	pdf.CellFormat(0, 8, "Платформа Hackpet — практические курсы по безопасному коду и DevSecOps.", "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.Ln(4)
	// Тонкая разделительная линия для более ровной композиции.
	left, _, right, _ := pdf.GetMargins()
	pageW, _ := pdf.GetPageSize()
	pdf.Line(left+10, pdf.GetY(), pageW-right-10, pdf.GetY())
	pdf.Ln(10)

	// Текст
	pdf.SetFont("DejaVu", "", 11)
	if studentName != "" {
		pdf.MultiCell(0, 6, "Настоящим подтверждается, что", "", "C", false)
		pdf.Ln(2)
		pdf.SetFont("DejaVu", "", 14)
		pdf.MultiCell(0, 8, studentName, "", "C", false)
		pdf.Ln(4)
		pdf.SetFont("DejaVu", "", 11)
		pdf.MultiCell(0, 6, "успешно прошёл курс", "", "C", false)
		pdf.Ln(3)
	} else {
		pdf.MultiCell(0, 6, "Настоящим подтверждается, что курс успешно пройден", "", "C", false)
		pdf.Ln(4)
	}
	pdf.SetFont("DejaVu", "", 14)
	pdf.MultiCell(0, 8, title, "", "C", false)
	pdf.Ln(10)
	pdf.SetFont("DejaVu", "", 11)
	pdf.MultiCell(0, 6, "Курс включает пошаговое прохождение модулей с теорией, лабораторными заданиями и тестированием. Все задания и итоговые проверки были выполнены с учётом порога прохождения.", "", "J", false)
	pdf.Ln(12)

	// Подвал: дата и бренд
	pdf.SetFont("DejaVu", "", 10)
	pdf.SetTextColor(80, 80, 80)
	pdf.CellFormat(0, 6, "Дата выдачи: "+date, "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 6, "Hackpet", "", 1, "R", false, 0, "")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	if pdf.Err() {
		return nil, pdf.Error()
	}
	return buf.Bytes(), nil
}
