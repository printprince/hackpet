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
	"/app/fonts/DejaVuSans.ttf",
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
		if _, err := os.Stat(rel); err == nil {
			return rel, nil
		}
	}
	return "", fmt.Errorf("шрифт для PDF не найден: поместите DejaVuSans.ttf в fonts/ или задайте CERT_FONT_PATH")
}

// Generate создаёт PDF-сертификат с дизайном в стиле Hackpet.
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

	pdf := gofpdf.New("L", "mm", "A4", "") // Landscape для классического формата диплома
	pdf.SetMargins(0, 0, 0)
	pdf.SetAutoPageBreak(false, 0)
	pdf.AddPage()

	pdf.AddUTF8FontFromBytes("DejaVu", "", fontCopy)
	if pdf.Err() {
		return nil, fmt.Errorf("добавление шрифта: %w", pdf.Error())
	}

	// A4 landscape: 297 x 210 mm
	W := 297.0
	H := 210.0

	// ── Цвета ───────────────────────────────────────────────────────────────
	navy := [3]int{12, 14, 35}     // тёмно-синий фон
	cyan := [3]int{34, 211, 238}   // акцент (цвет бренда)
	white := [3]int{255, 255, 255}
	offWhite := [3]int{248, 249, 252}
	grayText := [3]int{110, 115, 140}
	darkText := [3]int{18, 20, 48}

	setFill := func(c [3]int) { pdf.SetFillColor(c[0], c[1], c[2]) }
	setDraw := func(c [3]int) { pdf.SetDrawColor(c[0], c[1], c[2]) }
	setTxt := func(c [3]int) { pdf.SetTextColor(c[0], c[1], c[2]) }

	// ── 1. Фон страницы ─────────────────────────────────────────────────────
	setFill(offWhite)
	pdf.Rect(0, 0, W, H, "F")

	// ── 2. Левая тёмная полоса (header-sidebar) ──────────────────────────────
	sideW := 72.0
	setFill(navy)
	pdf.Rect(0, 0, sideW, H, "F")

	// Тонкая cyan-линия справа от боковой полосы
	setDraw(cyan)
	pdf.SetLineWidth(1.2)
	pdf.Line(sideW, 0, sideW, H)

	// ── 3. Декоративные элементы на левой полосе ────────────────────────────

	// Большой cyan-круг (декоративный, полупрозрачный эффект — светлее navy)
	setFill([3]int{20, 24, 60})
	pdf.Circle(sideW/2, 58, 38, "F")

	// Маленький cyan-кружок внутри
	setFill(cyan)
	pdf.Circle(sideW/2, 58, 26, "F")

	// Белый кружок поверх (создаёт кольцо)
	setFill([3]int{12, 14, 35})
	pdf.Circle(sideW/2, 58, 18, "F")

	// Буква "H" — логотип в центре кольца
	setTxt(cyan)
	pdf.SetFont("DejaVu", "", 22)
	pdf.SetXY(sideW/2-8, 51)
	pdf.CellFormat(16, 14, "HP", "", 0, "C", false, 0, "")

	// Hackpet текст под логотипом
	setTxt(white)
	pdf.SetFont("DejaVu", "", 11)
	pdf.SetXY(4, 86)
	pdf.CellFormat(sideW-8, 8, "HACKPET", "", 1, "C", false, 0, "")

	setTxt([3]int{150, 200, 220})
	pdf.SetFont("DejaVu", "", 6.5)
	pdf.SetXY(4, 94)
	pdf.CellFormat(sideW-8, 5, "ПЛАТФОРМА БЕЗОПАСНОГО КОДА", "", 1, "C", false, 0, "")

	// Горизонтальные декоративные линии на sidebar
	setDraw([3]int{30, 50, 90})
	pdf.SetLineWidth(0.3)
	for _, y := range []float64{110, 113, 116} {
		pdf.Line(14, y, sideW-14, y)
	}

	// Дата на sidebar
	setTxt([3]int{130, 180, 210})
	pdf.SetFont("DejaVu", "", 7)
	pdf.SetXY(4, 128)
	pdf.CellFormat(sideW-8, 5, "ДАТА ВЫДАЧИ", "", 1, "C", false, 0, "")

	setTxt(white)
	pdf.SetFont("DejaVu", "", 9)
	pdf.SetXY(4, 134)
	pdf.CellFormat(sideW-8, 6, date, "", 1, "C", false, 0, "")

	// Верификация внизу sidebar
	setTxt([3]int{130, 180, 210})
	pdf.SetFont("DejaVu", "", 6.5)
	pdf.SetXY(4, H-22)
	pdf.CellFormat(sideW-8, 5, "HACKPET VERIFIED", "", 1, "C", false, 0, "")

	setDraw(cyan)
	pdf.SetLineWidth(0.5)
	pdf.Rect(14, H-16, sideW-28, 8, "D")
	setTxt(cyan)
	pdf.SetFont("DejaVu", "", 6.5)
	pdf.SetXY(14, H-16)
	pdf.CellFormat(sideW-28, 8, "CERTIFICATE OF COMPLETION", "", 0, "C", false, 0, "")

	// ── 4. Правая часть — контент ───────────────────────────────────────────
	contentX := sideW + 12.0
	contentW := W - sideW - 20.0

	// Заголовок секции
	setTxt([3]int{100, 110, 140})
	pdf.SetFont("DejaVu", "", 7.5)
	pdf.SetXY(contentX, 18)
	pdf.CellFormat(contentW, 6, "СЕРТИФИКАТ О ПРОХОЖДЕНИИ КУРСА", "", 1, "L", false, 0, "")

	// Cyan-линия под заголовком
	setDraw(cyan)
	pdf.SetLineWidth(0.8)
	pdf.Line(contentX, 26, contentX+80, 26)
	setDraw([3]int{200, 205, 220})
	pdf.SetLineWidth(0.3)
	pdf.Line(contentX+81, 26, contentX+contentW, 26)

	// "Настоящим подтверждается, что"
	setTxt(grayText)
	pdf.SetFont("DejaVu", "", 9)
	pdf.SetXY(contentX, 36)
	pdf.CellFormat(contentW, 7, "Настоящим подтверждается, что", "", 1, "L", false, 0, "")

	// Имя студента
	name := studentName
	if name == "" {
		name = "Слушатель курса"
	}
	setTxt(darkText)
	pdf.SetFont("DejaVu", "", 26)
	pdf.SetXY(contentX, 44)
	pdf.CellFormat(contentW, 18, name, "", 1, "L", false, 0, "")

	// Тонкая линия под именем
	setDraw([3]int{200, 205, 220})
	pdf.SetLineWidth(0.4)
	pdf.Line(contentX, 63, contentX+contentW, 63)

	// "успешно прошёл курс"
	setTxt(grayText)
	pdf.SetFont("DejaVu", "", 9)
	pdf.SetXY(contentX, 68)
	pdf.CellFormat(contentW, 7, "успешно прошёл курс", "", 1, "L", false, 0, "")

	// Название курса
	setTxt(darkText)
	pdf.SetFont("DejaVu", "", 18)
	pdf.SetXY(contentX, 76)
	pdf.CellFormat(contentW, 13, title, "", 1, "L", false, 0, "")

	// Cyan-акцент под названием курса
	setFill(cyan)
	pdf.Rect(contentX, 91, 40, 2.5, "F")
	setFill([3]int{200, 205, 220})
	pdf.Rect(contentX+41, 91, contentW-41, 2.5, "F")

	// Описание курса
	setTxt(grayText)
	pdf.SetFont("DejaVu", "", 8)
	pdf.SetXY(contentX, 100)
	pdf.MultiCell(contentW, 5.5,
		"Курс включает пошаговое прохождение модулей с теорией, лабораторными заданиями и "+
			"практическими проверками кода. Все задания и итоговые проверки выполнены с учётом "+
			"порога прохождения платформы Hackpet.",
		"", "L", false)

	// ── 5. Нижние теги / бейджи ─────────────────────────────────────────────
	badgeY := 145.0
	badges := []string{"DevSecOps", "Безопасный код", "Практические лабы"}
	bx := contentX
	for _, badge := range badges {
		pdf.SetFont("DejaVu", "", 6.5)
		bw := pdf.GetStringWidth(badge) + 8
		setFill([3]int{230, 235, 248})
		setDraw([3]int{180, 190, 220})
		pdf.SetLineWidth(0.3)
		pdf.Rect(bx, badgeY, bw, 7, "FD")
		setTxt([3]int{70, 80, 120})
		pdf.SetXY(bx, badgeY)
		pdf.CellFormat(bw, 7, badge, "", 0, "C", false, 0, "")
		bx += bw + 4
	}

	// ── 6. Внешняя рамка страницы ───────────────────────────────────────────
	setDraw([3]int{180, 185, 210})
	pdf.SetLineWidth(0.5)
	pdf.Rect(3, 3, W-6, H-6, "D")

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	if pdf.Err() {
		return nil, pdf.Error()
	}
	return buf.Bytes(), nil
}
