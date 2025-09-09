public class Main {
	public static void main(String[] args) {
		Thread thread1 = new Tarefa1();
		Thread thread2 = new Thread(new Tarefa2());
		thread1.start();
		thread2.start();
	}
}
