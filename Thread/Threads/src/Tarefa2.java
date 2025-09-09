public class Tarefa2 implements Runnable {
	public void run() {
		for(int i=0; i<100; i++){
			System.out.println("Usando Runnable");
		}
	}
}