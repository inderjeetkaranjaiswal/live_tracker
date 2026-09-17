import 'package:flutter_test/flutter_test.dart';
import 'package:employee_app/main.dart';

void main() {
  testWidgets('EmployeeApp smoke test renders role selection screen', (WidgetTester tester) async {
    await tester.pumpWidget(const EmployeeApp(isLoggedIn: false));
    await tester.pumpAndSettle();

    // Verify that Role Selection is displayed
    expect(find.text('LIVE EMPLOYEE TRACKER'), findsOneWidget);
    expect(find.text('Employee Login'), findsOneWidget);
    expect(find.text('Admin Login'), findsOneWidget);
  });
}
