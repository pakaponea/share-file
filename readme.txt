targetคุณสามารถรันคำสั่งเหล่านี้ได้ทั้งนี้ขึ้นอยู่กับ

	server
		nuxt dev: เริ่มเซิร์ฟเวอร์การพัฒนา
		nuxt build: รวมแอปพลิเคชัน Nuxt ของคุณสำหรับการผลิต
		nuxt start: เริ่มเซิร์ฟเวอร์ที่ใช้งานจริง
	static
		nuxt dev: เริ่มเซิร์ฟเวอร์การพัฒนา (รับรู้แบบคงที่)
		nuxt generate: รวมแอปพลิเคชัน Nuxt ของคุณสำหรับการผลิตหากจำเป็น (การรับรู้แบบคงที่) และส่งออกแอปพลิเคชันของคุณเป็น HTML แบบคงที่ในdist/ไดเร็กทอรี
		nuxt start: ให้บริการแอปพลิเคชันการผลิตของคุณจากdist/
		
	
	เพื่อปรับปรุงประสบการณ์ผู้ใช้และบอก Nuxt ว่าคุณต้องการส่งออกแอปพลิเคชันของคุณไปยังโฮสติ้งแบบคงที่ เราขอแนะนำtargetตัวเลือกในnuxt.config.js:	
	nuxt generatewith target: 'static'
	
	npm run preview ต้อง generate ก่อนและตั้งค่า nuxt generatewith target: 'static'
	
	-รูปอยู่ไหน
	-deploy ขึ้นเซิฟเวอร์ต้องเอาอะไรขึ้นบ้าง