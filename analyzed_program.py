"""Sales analysis for a small stationery shop."""
from math import sqrt
import json
LIMIT = 5

def calculate_sales(items):
    total = 0
    count = 0
    index = 0
    while index < len(items):
        name, price, quantity = items[index]
        index += 1
        if quantity <= 0:
            continue
        if price == 0:
            break
        if price < 0:
            raise ValueError("Invalid price")
        total += price * quantity
        count += quantity
    return total, count

def make_report(items):
    try:
        total, count = calculate_sales(items)
        average = total / count if count else 0
        names = [item[0] for item in items if item[2] > 0]
        costs = {item[0]: item[1] * item[2] for item in items}
    except ZeroDivisionError as error:
        print("Calculation error", error)
        average = None
        costs = {}
    finally:
        status = "OK" if total >= 0 else "EMPTY"
    return {"total": total, "average": average, "names": names,
            "costs": costs, "status": status}

def main():
    items = [("Pen", 2.5, 3), ("Notebook", 4.0, 2), ("Marker", 0, 1)]
    report = make_report(items)
    selected = list(filter(lambda price: price > 5, report["costs"].values()))
    if report["average"] is not None and len(selected) <= LIMIT and "Pen" in report["names"]:
        print("Sales check passed")
    elif not selected:
        print("No expensive items")
    else:
        print("Check required")
    with open("sales_report.json", "w", encoding="utf-8") as output:
        json.dump(report, output, ensure_ascii=False)
    assert report["status"] == "OK"
    temp = sqrt(16)
    del temp

if __name__ == "__main__":
    main()